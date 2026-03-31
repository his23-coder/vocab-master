/**
 * VocabMaster - Google Apps Script バックエンド
 * 
 * 【セットアップ手順】
 * 1. https://script.google.com にアクセス
 * 2. 「新しいプロジェクト」をクリック
 * 3. この全コードを貼り付け
 * 4. メニュー「デプロイ」→「新しいデプロイ」
 * 5. 種類:「ウェブアプリ」を選択
 * 6. 「アクセスできるユーザー」→「全員」に設定（※データは自分のDriveに保存されるため安全）
 * 7. 「デプロイ」をクリック
 * 8. 表示されたURLをコピーし、VocabMasterの設定画面に貼り付け
 */

const FILE_NAME = 'VocabMaster_Backup.json';

// --- データ取得（復元用） ---
function doGet(e) {
  try {
    const files = DriveApp.getFilesByName(FILE_NAME);
    if (files.hasNext()) {
      const file = files.next();
      const content = file.getBlob().getDataAsString();
      return ContentService.createTextOutput(content)
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput('null')
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- データ保存（バックアップ用） ---
function doPost(e) {
  try {
    const data = e.postData.contents;
    const files = DriveApp.getFilesByName(FILE_NAME);
    
    if (files.hasNext()) {
      // 既存ファイルを上書き
      const file = files.next();
      file.setContent(data);
    } else {
      // 新規作成
      DriveApp.createFile(FILE_NAME, data, 'application/json');
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
