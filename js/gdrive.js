/**
 * gdrive.js - Google Apps Script 経由の Google Drive データ同期
 *
 * ユーザーは Google Apps Script にバックエンドコードを配置し、
 * そのURLをこのアプリの設定画面に登録するだけ。
 * OAuth不要・API設定不要のシンプルな構成。
 */

const DriveSync = (() => {
    const SETTINGS_KEY = 'vocabMaster_syncSettings';

    function getConfig() {
        try {
            const data = localStorage.getItem(SETTINGS_KEY);
            return data ? JSON.parse(data) : { scriptUrl: '', lastSync: null };
        } catch {
            return { scriptUrl: '', lastSync: null };
        }
    }

    function saveConfig(config) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
    }

    function getScriptUrl() {
        return getConfig().scriptUrl;
    }

    function setScriptUrl(url) {
        const config = getConfig();
        config.scriptUrl = url;
        saveConfig(config);
    }

    function getLastSync() {
        return getConfig().lastSync;
    }

    /**
     * データをGoogle Driveにバックアップ（Apps Script経由）
     */
    async function backup() {
        const url = getScriptUrl();
        if (!url) throw new Error('同期URLが未設定です');

        const data = StorageManager.exportData();

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: data,
            mode: 'no-cors'
        });

        // no-corsモードではレスポンスが読めないのでGET確認
        // 保存成功を前提として記録
        const config = getConfig();
        config.lastSync = new Date().toISOString();
        saveConfig(config);

        return true;
    }

    /**
     * Google Driveからデータを復元（Apps Script経由）
     */
    async function restore() {
        const url = getScriptUrl();
        if (!url) throw new Error('同期URLが未設定です');

        const response = await fetch(url + '?action=load', {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`復元に失敗しました (${response.status})`);
        }

        const jsonStr = await response.text();
        if (!jsonStr || jsonStr === 'null' || jsonStr === '{}') {
            throw new Error('バックアップデータがありません');
        }

        const success = StorageManager.importData(jsonStr);
        if (!success) throw new Error('データの読み込みに失敗しました');

        const config = getConfig();
        config.lastSync = new Date().toISOString();
        saveConfig(config);

        return true;
    }

    /**
     * 最終同期日時のフォーマット
     */
    function formatLastSync() {
        const last = getLastSync();
        if (!last) return '未同期';
        const d = new Date(last);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // --- 自動同期ロジック ---
    let backupTimeout = null;

    /**
     * データ変更時に呼ばれる（数秒後に裏でバックアップを実行）
     */
    function autoBackup() {
        const url = getScriptUrl();
        if (!url) return; // URL未設定時は何もしない

        if (backupTimeout) clearTimeout(backupTimeout);
        backupTimeout = setTimeout(async () => {
            try {
                const data = StorageManager.exportData();
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: data,
                    mode: 'no-cors'
                });
                
                const config = getConfig();
                config.lastSync = new Date().toISOString();
                saveConfig(config);
                console.log('[Sync] 自動バックアップ完了');
            } catch (e) {
                console.error('[Sync] 自動バックアップ失敗', e);
            }
        }, 5000); // 連続保存を防ぐため、5秒後に実行
    }

    /**
     * アプリ起動時に呼ばれる（クラウドのデータを取得し、マージする）
     */
    async function autoSync() {
        const url = getScriptUrl();
        if (!url) return; // URL未設定時は何もしない

        try {
            const response = await fetch(url + '?action=load', { method: 'GET' });
            if (!response.ok) return;

            const jsonStr = await response.text();
            if (!jsonStr || jsonStr === 'null' || jsonStr === '{}') return;

            const data = JSON.parse(jsonStr);
            if (data.items && Array.isArray(data.items)) {
                // アイテムのマージ処理
                const merged = StorageManager.mergeImportedItems(data.items);
                if (merged) {
                    console.log('[Sync] 新しいデータをクラウドから統合しました（マージ成功）');
                    // マージしたので、最新状態をローカル画面に反映させる必要がある
                    if (window.appRefreshData) window.appRefreshData();
                } else {
                    console.log('[Sync] ローカルのデータは最新です');
                }
            }
            
            const config = getConfig();
            config.lastSync = new Date().toISOString();
            saveConfig(config);

        } catch (e) {
            console.error('[Sync] 自動同期(フェッチ)失敗:', e);
        }
    }

    return {
        getConfig, saveConfig, getScriptUrl, setScriptUrl,
        getLastSync, formatLastSync,
        backup, restore, autoBackup, autoSync
    };
})();
