/**
 * VocabMaster - 単一HTMLファイル バンドルスクリプト
 * 全CSS/JSをインラインにまとめて1つのHTMLファイルを生成
 */
const fs = require('fs');
const path = require('path');

const base = __dirname;

const css = fs.readFileSync(path.join(base, 'css', 'style.css'), 'utf8');
const storageJs = fs.readFileSync(path.join(base, 'js', 'storage.js'), 'utf8');
const aiJs = fs.readFileSync(path.join(base, 'js', 'ai.js'), 'utf8');
const audioJs = fs.readFileSync(path.join(base, 'js', 'audio.js'), 'utf8');
const gdriveJs = fs.readFileSync(path.join(base, 'js', 'gdrive.js'), 'utf8');
const appJs = fs.readFileSync(path.join(base, 'js', 'app.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="theme-color" content="#050505">
    <title>VocabMaster</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>${css}</style>
</head>
<body>
    <div id="app">
        <header>
            <h1 id="screen-title">VocabMaster</h1>
            <button id="settings-btn" class="icon-btn" aria-label="設定"><i class="fas fa-cog"></i></button>
        </header>
        <main id="main-content"><div id="screen-container"></div></main>
        <nav id="bottom-nav">
            <button class="nav-item active" data-screen="home"><i class="fas fa-house"></i><span>ホーム</span></button>
            <button class="nav-item" data-screen="input"><i class="fas fa-plus-circle"></i><span>入力</span></button>
            <button class="nav-item" data-screen="confirm"><i class="fas fa-book-open"></i><span>確認</span></button>
            <button class="nav-item" data-screen="test"><i class="fas fa-vial"></i><span>テスト</span></button>
            <button class="nav-item" data-screen="review"><i class="fas fa-rotate"></i><span>復習</span></button>
        </nav>
        <div id="loading-overlay" class="hidden"><div class="loader"></div><p>AI取得中...</p></div>
        <div id="toast" class="hidden"></div>
    </div>
    <script>${storageJs}</script>
    <script>${aiJs}</script>
    <script>${audioJs}</script>
    <script>${gdriveJs}</script>
    <script>${appJs}</script>
</body>
</html>`;

const outPath = path.join(base, 'VocabMaster.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('✅ バンドル完了: ' + outPath);
console.log('   ファイルサイズ: ' + (fs.statSync(outPath).size / 1024).toFixed(1) + ' KB');
