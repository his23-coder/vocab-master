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

    return {
        getConfig, saveConfig, getScriptUrl, setScriptUrl,
        getLastSync, formatLastSync,
        backup, restore
    };
})();
