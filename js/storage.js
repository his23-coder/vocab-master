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

    // --- パート管理 (20個ずつ) ---
    function getItemsByType(type) {
        return getAllItems().filter(i => i.type === type);
    }

    function getItemsByPart(type, partIndex) {
        const allItems = getItemsByType(type);
        const start = partIndex * 20;
        return allItems.slice(start, start + 20);
    }

    function getPartCount(type) {
        const count = getItemsByType(type).length;
        return Math.ceil(count / 20);
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
        recordCorrect, recordIncorrect, getDueItems,
        getStats,
        getSettings, saveSettings,
        exportData, importData, clearAllData,
        mergeImportedItems
    };
})();
