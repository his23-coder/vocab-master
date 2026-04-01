/**
 * storage.js - LocalStorageを使ったデータ永続化管理
 * 学習履歴・忘却曲線アルゴリズム・統計機能を含む
 */

const StorageManager = (() => {
    const KEYS = {
        ITEMS: 'vocabMaster_items',
        SETTINGS: 'vocabMaster_settings'
    };

    // 忘却曲線ベースの復習間隔（日数）
    const REVIEW_INTERVALS = [1, 7, 30, 90];

    // --- アイテム CRUD ---
    function getAllItems() {
        try {
            const data = localStorage.getItem(KEYS.ITEMS);
            const items = data ? JSON.parse(data) : [];
            return items.map(migrateItem);
        } catch (e) {
            console.error('データの読み取り失敗:', e);
            return [];
        }
    }

    // 旧データ形式からのマイグレーション
    function migrateItem(item) {
        // synonyms が文字列の場合は配列に変換（旧仕様1）
        if (typeof item.synonyms === 'string') {
            const parts = item.synonyms.split('/').map(s => s.trim());
            item.synonyms = parts[0] ? parts[0].split(',').map(s => s.trim()).filter(Boolean) : [];
            item.antonyms = parts[1] ? parts[1].split(',').map(s => s.trim()).filter(Boolean) : [];
        }

        // 文字列の配列を {word, ja} 形式にマイグレーション（新仕様・対訳対応）
        if (Array.isArray(item.synonyms) && item.synonyms.length > 0 && typeof item.synonyms[0] === 'string') {
            item.synonyms = item.synonyms.map(s => ({ word: s, ja: '' }));
        }
        if (Array.isArray(item.antonyms) && item.antonyms.length > 0 && typeof item.antonyms[0] === 'string') {
            item.antonyms = item.antonyms.map(s => ({ word: s, ja: '' }));
        }
        
        // 例文を {en, ja} 形式にマイグレーション（新仕様・対訳対応）
        if (typeof item.example === 'string') {
            if (item.example.trim()) {
                item.example = { en: item.example, ja: '' };
            } else {
                item.example = null;
            }
        }

        // 新フィールドのデフォルト値を保証
        if (!Array.isArray(item.synonyms)) item.synonyms = [];
        if (!Array.isArray(item.antonyms)) item.antonyms = [];
        if (item.lastStudiedAt === undefined) item.lastStudiedAt = null;
        if (item.nextReviewAt === undefined) item.nextReviewAt = null;
        if (item.correctCount === undefined) item.correctCount = 0;
        if (item.reviewStage === undefined) item.reviewStage = 0;
        if (item.isWeak === undefined) item.isWeak = false;
        if (item.updatedAt === undefined) item.updatedAt = Date.now();
        if (item.origin === undefined) item.origin = item.morphology || '';
        return item;
    }

    function saveItem(item) {
        const items = getAllItems();
        item.id = item.id || generateId();
        item.createdAt = item.createdAt || new Date().toISOString();
        item.updatedAt = Date.now();
        item.isWeak = item.isWeak || false;
        item.lastStudiedAt = item.lastStudiedAt || null;
        item.nextReviewAt = item.nextReviewAt || null;
        item.correctCount = item.correctCount || 0;
        item.reviewStage = item.reviewStage || 0;

        if (!Array.isArray(item.synonyms)) item.synonyms = [];
        if (!Array.isArray(item.antonyms)) item.antonyms = [];

        const existingIdx = items.findIndex(i => i.id === item.id);
        if (existingIdx >= 0) {
            items[existingIdx] = { ...items[existingIdx], ...item };
        } else {
            items.push(item);
        }

        _persist(items);
        return item;
    }

    function deleteItem(id) {
        let items = getAllItems();
        items = items.filter(i => i.id !== id);
        _persist(items);
    }

    function getItem(id) {
        return getAllItems().find(i => i.id === id) || null;
    }

    // --- 苦手管理 ---
    function toggleWeak(id, isWeak) {
        const items = getAllItems();
        const item = items.find(i => i.id === id);
        if (item) {
            item.isWeak = isWeak;
            item.updatedAt = Date.now();
            _persist(items);
        }
    }

    function getWeakItems() {
        return getAllItems().filter(i => i.isWeak);
    }

    // --- パート管理 (100個/パート, 20個/セクション) ---
    const PART_SIZE = 100;
    const SECTION_SIZE = 20;

    function getItemsByType(type) {
        return getAllItems().filter(i => i.type === type);
    }

    function getItemsByPart(type, partIndex) {
        const allItems = getItemsByType(type);
        const start = partIndex * PART_SIZE;
        return allItems.slice(start, start + PART_SIZE);
    }

    function getPartCount(type) {
        const count = getItemsByType(type).length;
        return Math.ceil(count / PART_SIZE);
    }

    function getSectionItems(type, partIndex, sectionIndex) {
        const partItems = getItemsByPart(type, partIndex);
        const start = sectionIndex * SECTION_SIZE;
        return partItems.slice(start, start + SECTION_SIZE);
    }

    function getSectionCount(type, partIndex) {
        const partItems = getItemsByPart(type, partIndex);
        return Math.ceil(partItems.length / SECTION_SIZE);
    }

    // --- 強制復習アルゴリズム ---
    /**
     * 正解時: 復習ステージを進め、次回復習日を設定
     */
    function recordCorrect(id) {
        const items = getAllItems();
        const item = items.find(i => i.id === id);
        if (!item) return;

        item.lastStudiedAt = new Date().toISOString();
        item.correctCount = (item.correctCount || 0) + 1;
        item.updatedAt = Date.now();

        const stage = item.reviewStage || 0;
        if (stage < REVIEW_INTERVALS.length) {
            const days = REVIEW_INTERVALS[stage];
            const next = new Date();
            next.setDate(next.getDate() + days);
            item.nextReviewAt = next.toISOString();
            item.reviewStage = stage + 1;
        } else {
            // マスター済み（ステージ4超）
            item.nextReviewAt = null;
        }

        _persist(items);
        return item;
    }

    /**
     * 不正解時: 苦手リストに追加し、ステージをリセット
     */
    function recordIncorrect(id) {
        const items = getAllItems();
        const item = items.find(i => i.id === id);
        if (!item) return;

        item.isWeak = true;
        item.reviewStage = 0;
        item.correctCount = 0;
        item.lastStudiedAt = new Date().toISOString();
        item.nextReviewAt = null;
        item.updatedAt = Date.now();

        _persist(items);
        return item;
    }

    /**
     * 今日復習が必要なアイテムを取得
     * - nextReviewAt が現在以前
     * - まだ一度も学習していない（nextReviewAt === null かつ reviewStage === 0）
     */
    function getDueItems() {
        const now = new Date();
        return getAllItems().filter(item => {
            if (item.reviewStage >= REVIEW_INTERVALS.length && !item.isWeak && item.nextReviewAt === null) {
                return false; // マスター済み
            }
            if (item.nextReviewAt === null && item.reviewStage === 0) {
                return true; // 未学習
            }
            if (item.nextReviewAt && new Date(item.nextReviewAt) <= now) {
                return true; // 復習期限到来
            }
            return false;
        });
    }

    // --- 統計情報 ---
    function getStats() {
        const items = getAllItems();
        const total = items.length;
        const words = items.filter(i => i.type === 'word').length;
        const phrases = items.filter(i => i.type === 'phrase').length;
        const weakCount = items.filter(i => i.isWeak).length;
        const mastered = items.filter(i => i.reviewStage >= REVIEW_INTERVALS.length).length;
        const dueToday = getDueItems().length;
        const studied = items.filter(i => i.lastStudiedAt !== null).length;

        return {
            total,
            words,
            phrases,
            weakCount,
            mastered,
            dueToday,
            studied,
            masteryRate: total > 0 ? Math.round((mastered / total) * 100) : 0
        };
    }

    // --- 設定 ---
    function getSettings() {
        try {
            const data = localStorage.getItem(KEYS.SETTINGS);
            return data ? JSON.parse(data) : { geminiApiKey: '' };
        } catch (e) {
            return { geminiApiKey: '' };
        }
    }

    function saveSettings(settings) {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    }

    // --- エクスポート / インポート ---
    function exportData() {
        const data = {
            version: 2,
            exportedAt: new Date().toISOString(),
            items: getAllItems(),
            settings: getSettings()
        };
        return JSON.stringify(data, null, 2);
    }

    function importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.items && Array.isArray(data.items)) {
                localStorage.setItem(KEYS.ITEMS, JSON.stringify(data.items));
            }
            if (data.settings) {
                saveSettings(data.settings);
            }
            return true;
        } catch (e) {
            console.error('インポート失敗:', e);
            return false;
        }
    }

    function clearAllData() {
        localStorage.removeItem(KEYS.ITEMS);
    }

    // --- ストリーク（連続記録）---
    const STREAK_KEY = 'vocabMaster_streak';

    function recordStreak() {
        const today = new Date().toISOString().slice(0, 10);
        let days = [];
        try {
            days = JSON.parse(localStorage.getItem(STREAK_KEY)) || [];
        } catch (e) { days = []; }
        if (!days.includes(today)) {
            days.push(today);
            // 過去90日分だけ保持
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 90);
            days = days.filter(d => d >= cutoff.toISOString().slice(0, 10));
            localStorage.setItem(STREAK_KEY, JSON.stringify(days));
        }
    }

    function getStreakInfo() {
        let days = [];
        try {
            days = JSON.parse(localStorage.getItem(STREAK_KEY)) || [];
        } catch (e) { days = []; }
        days.sort();

        // 連続日数を計算（今日 or 昨日から遡る）
        const today = new Date();
        today.setHours(0,0,0,0);
        const todayStr = today.toISOString().slice(0, 10);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        let streak = 0;
        let checkDate = days.includes(todayStr) ? new Date(today) : (days.includes(yesterdayStr) ? new Date(yesterday) : null);

        if (checkDate) {
            while (true) {
                const ds = checkDate.toISOString().slice(0, 10);
                if (days.includes(ds)) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }
        }

        // 過去7日間のアクティビティ
        const week = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const ds = d.toISOString().slice(0, 10);
            week.push({
                date: ds,
                day: ['日','月','火','水','木','金','土'][d.getDay()],
                active: days.includes(ds)
            });
        }

        return { streak, week, activeDays: days };
    }

    // --- ユーティリティ ---
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    function _persist(items) {
        localStorage.setItem(KEYS.ITEMS, JSON.stringify(items));
        // データ変更時に自動バックアップをトリガー
        if (window.DriveSync && window.DriveSync.autoBackup) {
            window.DriveSync.autoBackup();
        }
    }

    // --- 同期用マージ ---
    function mergeImportedItems(importedItems) {
        const localItems = getAllItems();
        const localMap = new Map(localItems.map(i => [i.id, i]));
        let changed = false;

        importedItems.forEach(cloudItem => {
            const localItem = localMap.get(cloudItem.id);
            // ローカルに無い、またはクラウド側の方が新しければ採用
            if (!localItem || (cloudItem.updatedAt || 0) > (localItem.updatedAt || 0)) {
                localMap.set(cloudItem.id, cloudItem);
                changed = true;
            }
        });

        if (changed) {
            const newItems = Array.from(localMap.values());
            localStorage.setItem(KEYS.ITEMS, JSON.stringify(newItems));
            return true;
        }
        return false;
    }

    return {
        getAllItems, saveItem, deleteItem, getItem,
        toggleWeak, getWeakItems,
        getItemsByType, getItemsByPart, getPartCount,
        getSectionItems, getSectionCount,
        recordCorrect, recordIncorrect, getDueItems,
        getStats,
        getSettings, saveSettings,
        exportData, importData, clearAllData,
        mergeImportedItems,
        recordStreak, getStreakInfo
    };
})();
