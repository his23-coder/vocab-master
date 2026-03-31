/**
 * app.js - VocabMaster アプリ全体の UI 制御と各モードのロジック
 * ダッシュボード、入力、確認、テスト、復習の5画面
 */

const App = (() => {
    const screens = {
        home: renderHomeScreen,
        input: renderInputScreen,
        confirm: renderConfirmScreen,
        test: renderTestScreen,
        review: renderReviewScreen
    };

    let currentScreen = 'home';
    let currentData = [];
    let currentIndex = 0;
    let testResults = { correct: 0, incorrect: 0 };

    // --- 初期化 ---
    function init() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
        });

        document.getElementById('settings-btn').addEventListener('click', showSettings);

        switchScreen('home');
    }

    // --- 画面切り替え ---
    function switchScreen(screenId) {
        currentScreen = screenId;
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.screen === screenId);
        });

        const titles = {
            home: 'VocabMaster',
            input: '単語登録',
            confirm: '確認学習',
            test: 'テスト',
            review: '苦手復習'
        };
        document.getElementById('screen-title').textContent = titles[screenId] || 'VocabMaster';

        const container = document.getElementById('screen-container');
        container.innerHTML = '';
        if (screens[screenId]) {
            screens[screenId](container);
        }
    }

    // =============================================
    // 🏠 ダッシュボード
    // =============================================
    function renderHomeScreen(container) {
        const stats = StorageManager.getStats();

        container.innerHTML = `
            <div class="section-title">学習状況</div>
            <div class="stat-grid">
                <div class="stat-card primary">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">登録語数</div>
                </div>
                <div class="stat-card accent">
                    <div class="stat-number">${stats.dueToday}</div>
                    <div class="stat-label">今日の復習</div>
                </div>
                <div class="stat-card success">
                    <div class="stat-number">${stats.mastered}</div>
                    <div class="stat-label">マスター済み</div>
                </div>
                <div class="stat-card warning">
                    <div class="stat-number">${stats.weakCount}</div>
                    <div class="stat-label">苦手語</div>
                </div>
            </div>

            <div class="progress-container">
                <div class="progress-header">
                    <span class="progress-title">習得率</span>
                    <span class="progress-value">${stats.masteryRate}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%;" id="mastery-bar"></div>
                </div>
            </div>

            <div class="section-title">内訳</div>
            <div class="stat-grid">
                <div class="stat-card primary" style="cursor:pointer;" id="home-words-btn">
                    <div class="stat-number">${stats.words}</div>
                    <div class="stat-label">単語</div>
                </div>
                <div class="stat-card accent" style="cursor:pointer;" id="home-phrases-btn">
                    <div class="stat-number">${stats.phrases}</div>
                    <div class="stat-label">熟語</div>
                </div>
            </div>

            ${stats.dueToday > 0 ? `
                <button class="btn-primary mt-16" id="start-review-btn">
                    <i class="fas fa-play"></i> 今日の復習を開始（${stats.dueToday}語）
                </button>
            ` : ''}

            ${stats.total === 0 ? `
                <div class="card mt-16 text-center" style="animation-delay: 0.3s;">
                    <p style="color: var(--text-secondary); line-height: 1.6;">
                        <i class="fas fa-lightbulb" style="color: var(--warning); font-size: 1.5rem; display: block; margin-bottom: 12px;"></i>
                        まだ単語が登録されていません。<br>
                        「入力」タブから単語を登録しましょう！
                    </p>
                </div>
            ` : ''}
        `;

        // プログレスバーアニメーション
        requestAnimationFrame(() => {
            setTimeout(() => {
                const bar = document.getElementById('mastery-bar');
                if (bar) bar.style.width = stats.masteryRate + '%';
            }, 100);
        });

        // ボタンイベント
        const startBtn = document.getElementById('start-review-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                currentData = StorageManager.getDueItems().sort(() => Math.random() - 0.5);
                currentIndex = 0;
                testResults = { correct: 0, incorrect: 0 };
                switchScreen('test');
                showTestCard();
            });
        }

        const wordsBtn = document.getElementById('home-words-btn');
        if (wordsBtn) wordsBtn.addEventListener('click', () => switchScreen('confirm'));

        const phrasesBtn = document.getElementById('home-phrases-btn');
        if (phrasesBtn) phrasesBtn.addEventListener('click', () => switchScreen('confirm'));
    }

    // =============================================
    // ① 入力モード
    // =============================================
    function renderInputScreen(container) {
        container.innerHTML = `
            <div class="card">
                <div class="input-group">
                    <label>英単語・英熟語</label>
                    <input type="text" id="input-term" placeholder="例: consistency" autocomplete="off">
                </div>
                <button id="auto-fetch-btn" class="btn-primary">
                    <i class="fas fa-wand-magic-sparkles"></i> AIで自動取得
                </button>
            </div>
            <div id="edit-area" class="hidden">
                <div class="card" style="animation-delay: 0.1s;">
                    <div class="input-group">
                        <label>意味</label>
                        <input type="text" id="edit-meaning">
                    </div>
                    <div class="input-group">
                        <label>同義語（カンマ区切り）</label>
                        <input type="text" id="edit-synonyms" placeholder="例: coherence, uniformity">
                    </div>
                    <div class="input-group">
                        <label>対義語（カンマ区切り）</label>
                        <input type="text" id="edit-antonyms" placeholder="例: inconsistency">
                    </div>
                    <div class="input-group">
                        <label>派生語・品詞変化</label>
                        <textarea id="edit-derivatives" rows="2" placeholder="例: consistent (形容詞), consistently (副詞)"></textarea>
                    </div>
                    <div class="input-group">
                        <label>例文</label>
                        <textarea id="edit-example" rows="2" placeholder="例: Consistency is the key to success."></textarea>
                    </div>
                    <div class="input-group">
                        <label>分類</label>
                        <select id="edit-type">
                            <option value="word">単語編</option>
                            <option value="phrase">熟語編</option>
                        </select>
                    </div>
                    <button id="save-btn" class="btn-primary">
                        <i class="fas fa-check"></i> この内容で登録
                    </button>
                </div>
            </div>
        `;

        const inputTerm = document.getElementById('input-term');
        const autoFetchBtn = document.getElementById('auto-fetch-btn');
        const editArea = document.getElementById('edit-area');

        // Enterキーで自動取得
        inputTerm.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') autoFetchBtn.click();
        });

        autoFetchBtn.addEventListener('click', async () => {
            const term = inputTerm.value.trim();
            if (!term) return showToast('単語を入力してください');

            showLoading(true);
            try {
                const details = await AIManager.fetchWordDetails(term);
                document.getElementById('edit-meaning').value = details.meaning;
                document.getElementById('edit-synonyms').value = details.synonyms.join(', ');
                document.getElementById('edit-antonyms').value = details.antonyms.join(', ');
                document.getElementById('edit-derivatives').value = details.derivatives;
                document.getElementById('edit-example').value = details.example;

                // 熟語かどうかを自動判定
                if (term.includes(' ')) {
                    document.getElementById('edit-type').value = 'phrase';
                }

                editArea.classList.remove('hidden');
                autoFetchBtn.innerHTML = '<i class="fas fa-rotate"></i> 再取得';
            } catch (e) {
                showToast(e.message);
            } finally {
                showLoading(false);
            }
        });

        document.getElementById('save-btn').addEventListener('click', () => {
            const term = inputTerm.value.trim();
            if (!term) return showToast('単語を入力してください');

            const synonymsStr = document.getElementById('edit-synonyms').value;
            const antonymsStr = document.getElementById('edit-antonyms').value;

            const item = {
                type: document.getElementById('edit-type').value,
                term: term,
                meaning: document.getElementById('edit-meaning').value,
                synonyms: synonymsStr ? synonymsStr.split(',').map(s => s.trim()).filter(Boolean) : [],
                antonyms: antonymsStr ? antonymsStr.split(',').map(s => s.trim()).filter(Boolean) : [],
                derivatives: document.getElementById('edit-derivatives').value,
                example: document.getElementById('edit-example').value
            };

            StorageManager.saveItem(item);
            showToast('✅ 登録しました！');

            // フォームリセット
            inputTerm.value = '';
            editArea.classList.add('hidden');
            autoFetchBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> AIで自動取得';

            // フォーカスを入力欄に戻す
            inputTerm.focus();
        });
    }

    // =============================================
    // ② 確認モード
    // =============================================
    function renderConfirmScreen(container) {
        const wordParts = StorageManager.getPartCount('word');
        const phraseParts = StorageManager.getPartCount('phrase');

        if (wordParts === 0 && phraseParts === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-book-open"></i>
                    <p>まだ単語が登録されていません。<br>「入力」タブから登録しましょう。</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="tab-selector">
                <button class="tab-btn active" data-type="word" id="tab-word">単語編 (${StorageManager.getItemsByType('word').length})</button>
                <button class="tab-btn" data-type="phrase" id="tab-phrase">熟語編 (${StorageManager.getItemsByType('phrase').length})</button>
            </div>
            <div id="part-list-container"></div>
        `;

        const tabWord = document.getElementById('tab-word');
        const tabPhrase = document.getElementById('tab-phrase');

        function showParts(type) {
            tabWord.classList.toggle('active', type === 'word');
            tabPhrase.classList.toggle('active', type === 'phrase');

            const parts = StorageManager.getPartCount(type);
            const listContainer = document.getElementById('part-list-container');

            if (parts === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-folder-open"></i>
                        <p>${type === 'word' ? '単語' : '熟語'}はまだ登録されていません。</p>
                    </div>
                `;
                return;
            }

            let html = '';
            for (let i = 0; i < parts; i++) {
                const items = StorageManager.getItemsByPart(type, i);
                const start = i * 20 + 1;
                const end = start + items.length - 1;
                html += `
                    <div class="part-card" data-type="${type}" data-part="${i}" style="animation-delay: ${i * 0.06}s;">
                        <div class="part-info">
                            <div class="part-name">Part ${i + 1}</div>
                            <div class="part-range">${start} 〜 ${end}（${items.length}語）</div>
                        </div>
                        <span class="part-arrow"><i class="fas fa-chevron-right"></i></span>
                    </div>
                `;
            }
            listContainer.innerHTML = html;

            // パートクリックイベント
            listContainer.querySelectorAll('.part-card').forEach(card => {
                card.addEventListener('click', () => {
                    const t = card.dataset.type;
                    const p = parseInt(card.dataset.part, 10);
                    startStudy(t, p);
                });
            });
        }

        tabWord.addEventListener('click', () => showParts('word'));
        tabPhrase.addEventListener('click', () => showParts('phrase'));

        showParts('word');
    }

    function startStudy(type, partIndex) {
        currentData = StorageManager.getItemsByPart(type, partIndex);
        currentIndex = 0;
        showFlashcard();
    }

    function showFlashcard() {
        const container = document.getElementById('screen-container');
        const item = currentData[currentIndex];

        if (!item) {
            container.innerHTML = `
                <div class="result-card">
                    <div style="font-size: 3rem; margin-bottom: 12px;">🎉</div>
                    <h2 style="color: var(--text-primary); margin-bottom: 8px;">学習完了！</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 24px;">このパートの確認が終わりました。</p>
                    <button class="btn-primary" id="back-to-parts-btn">パート一覧に戻る</button>
                </div>
            `;
            document.getElementById('back-to-parts-btn').addEventListener('click', () => switchScreen('confirm'));
            return;
        }

        const synText = item.synonyms.length > 0 ? item.synonyms.join(', ') : '—';
        const antText = item.antonyms.length > 0 ? item.antonyms.join(', ') : '—';
        const safeExample = escapeQuotes(item.example || '');

        container.innerHTML = `
            <div class="flashcard" id="card">
                <div class="flashcard-inner">
                    <div class="flashcard-front">
                        <div class="word-main">${escapeHtml(item.term)}</div>
                        <button class="audio-btn mt-12" id="play-term-btn">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <p style="margin-top: 16px; font-size: 0.85rem; color: var(--text-muted);">タップで裏返す</p>
                    </div>
                    <div class="flashcard-back">
                        <div class="word-meaning">${escapeHtml(item.meaning)}</div>
                        <div class="detail-label">同義語</div>
                        <div class="word-detail">${escapeHtml(synText)}</div>
                        <div class="detail-label">対義語</div>
                        <div class="word-detail">${escapeHtml(antText)}</div>
                        ${item.example ? `
                            <div class="detail-label">例文</div>
                            <div class="word-example">${escapeHtml(item.example)}</div>
                            <button class="audio-btn mt-8" id="play-example-btn">
                                <i class="fas fa-volume-up"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div class="flex-row">
                <button class="btn-outline flex-1" id="prev-btn" ${currentIndex === 0 ? 'disabled style="opacity:0.4"' : ''}>
                    <i class="fas fa-arrow-left"></i> 前へ
                </button>
                <button class="btn-primary flex-1" id="next-btn" style="width:auto;">
                    次へ <i class="fas fa-arrow-right"></i>
                </button>
            </div>
            <div class="card-counter">${currentIndex + 1} / ${currentData.length}</div>
        `;

        // フラッシュカードのタップ反転
        const cardEl = document.getElementById('card');
        cardEl.addEventListener('click', (e) => {
            if (e.target.closest('.audio-btn')) return;
            cardEl.classList.toggle('flipped');
        });

        // 音声再生
        const playTermBtn = document.getElementById('play-term-btn');
        playTermBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            AudioManager.play(item.term);
        });

        const playExampleBtn = document.getElementById('play-example-btn');
        if (playExampleBtn) {
            playExampleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                AudioManager.play(item.example);
            });
        }

        // ナビゲーション
        document.getElementById('next-btn').addEventListener('click', () => {
            currentIndex++;
            showFlashcard();
        });
        document.getElementById('prev-btn').addEventListener('click', () => {
            if (currentIndex > 0) {
                currentIndex--;
                showFlashcard();
            }
        });
    }

    // =============================================
    // ③ テストモード
    // =============================================
    function renderTestScreen(container) {
        const allItems = StorageManager.getAllItems();
        if (allItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-vial"></i>
                    <p>まだ単語が登録されていません。<br>「入力」タブから登録しましょう。</p>
                </div>
            `;
            return;
        }

        const dueItems = StorageManager.getDueItems();

        container.innerHTML = `
            <div class="section-title">テスト範囲</div>
            <div class="card" style="cursor:pointer;" id="test-due-btn">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div>
                        <div style="font-weight:700; color: var(--text-primary);">要復習のみ</div>
                        <div class="text-xs text-muted mt-4">${dueItems.length}語が復習対象</div>
                    </div>
                    <span style="color: var(--accent); font-size: 1.5rem;"><i class="fas fa-bullseye"></i></span>
                </div>
            </div>
            <div class="card" style="cursor:pointer; animation-delay: 0.08s;" id="test-all-btn">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div>
                        <div style="font-weight:700; color: var(--text-primary);">全単語テスト</div>
                        <div class="text-xs text-muted mt-4">${allItems.length}語からランダム出題</div>
                    </div>
                    <span style="color: var(--secondary); font-size: 1.5rem;"><i class="fas fa-shuffle"></i></span>
                </div>
            </div>
        `;

        document.getElementById('test-due-btn').addEventListener('click', () => {
            if (dueItems.length === 0) {
                showToast('復習対象の単語がありません');
                return;
            }
            currentData = [...dueItems].sort(() => Math.random() - 0.5);
            currentIndex = 0;
            testResults = { correct: 0, incorrect: 0 };
            showTestCard();
        });

        document.getElementById('test-all-btn').addEventListener('click', () => {
            currentData = [...allItems].sort(() => Math.random() - 0.5);
            currentIndex = 0;
            testResults = { correct: 0, incorrect: 0 };
            showTestCard();
        });
    }

    function showTestCard() {
        const container = document.getElementById('screen-container');
        const item = currentData[currentIndex];

        if (!item) {
            // テスト完了 - 結果サマリー
            const total = testResults.correct + testResults.incorrect;
            const rate = total > 0 ? Math.round((testResults.correct / total) * 100) : 0;

            container.innerHTML = `
                <div class="result-card">
                    <div style="font-size: 3rem; margin-bottom: 16px;">
                        ${rate >= 80 ? '🏆' : rate >= 50 ? '💪' : '📚'}
                    </div>
                    <div class="result-score">${rate}%</div>
                    <div class="result-label">正答率</div>
                    <div style="display:flex; gap: 24px; justify-content:center; margin-bottom: 24px;">
                        <div>
                            <div style="font-size: 1.5rem; font-weight:700; color: var(--success);">${testResults.correct}</div>
                            <div class="text-xs text-muted">正解</div>
                        </div>
                        <div>
                            <div style="font-size: 1.5rem; font-weight:700; color: var(--danger);">${testResults.incorrect}</div>
                            <div class="text-xs text-muted">不正解</div>
                        </div>
                    </div>
                    <button class="btn-primary mb-12" id="retry-test-btn">
                        <i class="fas fa-rotate"></i> もう一度テスト
                    </button>
                    <button class="btn-outline" style="width:100%;" id="back-home-btn">
                        ホームに戻る
                    </button>
                </div>
            `;

            document.getElementById('retry-test-btn').addEventListener('click', () => switchScreen('test'));
            document.getElementById('back-home-btn').addEventListener('click', () => switchScreen('home'));
            return;
        }

        container.innerHTML = `
            <div class="card-counter" style="margin-top:0; margin-bottom:16px;">
                ${currentIndex + 1} / ${currentData.length}
            </div>
            <div class="test-card" id="reveal-card">
                <div class="word-main" style="margin-bottom: 8px;">${escapeHtml(item.term)}</div>
                <button class="audio-btn" id="test-play-btn" style="margin-bottom: 16px;">
                    <i class="fas fa-volume-up"></i>
                </button>
                <p id="reveal-hint" class="text-sm text-muted">タップで正解を表示</p>
                <div id="answer-area" class="hidden" style="width:100%;">
                    <div class="word-meaning mt-12">${escapeHtml(item.meaning)}</div>
                    ${item.example ? `<div class="word-example mt-8">${escapeHtml(item.example)}</div>` : ''}
                    <div class="test-buttons mt-20">
                        <button class="btn-success flex-1" id="btn-correct">
                            <i class="fas fa-circle-check"></i> 正解
                        </button>
                        <button class="btn-danger flex-1" id="btn-incorrect">
                            <i class="fas fa-circle-xmark"></i> 不正解
                        </button>
                    </div>
                </div>
            </div>
        `;

        const revealCard = document.getElementById('reveal-card');
        const answerArea = document.getElementById('answer-area');
        const revealHint = document.getElementById('reveal-hint');

        // 音声再生
        document.getElementById('test-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            AudioManager.play(item.term);
        });

        // 回答表示
        revealCard.addEventListener('click', (e) => {
            if (e.target.closest('.audio-btn') || e.target.closest('.btn-success') || e.target.closest('.btn-danger')) return;
            answerArea.classList.remove('hidden');
            revealHint.classList.add('hidden');
        });

        // 正解
        document.getElementById('btn-correct').addEventListener('click', (e) => {
            e.stopPropagation();
            StorageManager.recordCorrect(item.id);
            testResults.correct++;
            revealCard.classList.add('animate-success');
            setTimeout(() => {
                currentIndex++;
                showTestCard();
            }, 350);
        });

        // 不正解
        document.getElementById('btn-incorrect').addEventListener('click', (e) => {
            e.stopPropagation();
            StorageManager.recordIncorrect(item.id);
            testResults.incorrect++;
            revealCard.classList.add('animate-danger');
            setTimeout(() => {
                currentIndex++;
                showTestCard();
            }, 350);
        });
    }

    // =============================================
    // ④ 復習モード（苦手リスト）
    // =============================================
    function renderReviewScreen(container) {
        const weakItems = StorageManager.getWeakItems();

        if (weakItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-medal"></i>
                    <p>苦手リストは空です！<br>テストモードで間違えた単語が<br>ここに表示されます。</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="section-title">苦手リスト（${weakItems.length}語）</div>
            <div class="flex-row mb-16">
                <button class="btn-primary flex-1" id="review-flashcard-btn">
                    <i class="fas fa-layer-group"></i> フラッシュカード
                </button>
            </div>
            <div id="weak-list"></div>
        `;

        const weakList = document.getElementById('weak-list');
        weakItems.forEach((item, idx) => {
            const el = document.createElement('div');
            el.className = 'review-item';
            el.style.animationDelay = `${idx * 0.04}s`;
            el.innerHTML = `
                <div>
                    <div class="review-item-word">${escapeHtml(item.term)}</div>
                    <div class="review-item-meaning">${escapeHtml(item.meaning)}</div>
                </div>
                <button class="btn-ghost remove-weak-btn" data-id="${item.id}" title="苦手解除">
                    <i class="fas fa-xmark"></i>
                </button>
            `;
            weakList.appendChild(el);
        });

        // 苦手解除
        weakList.querySelectorAll('.remove-weak-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                StorageManager.toggleWeak(id, false);
                showToast('苦手リストから解除しました');
                renderReviewScreen(container);
            });
        });

        // フラッシュカードモードで確認
        document.getElementById('review-flashcard-btn').addEventListener('click', () => {
            currentData = weakItems;
            currentIndex = 0;
            showFlashcard();
        });
    }

    // =============================================
    // ⚙️ 設定画面
    // =============================================
    function showSettings() {
        const container = document.getElementById('screen-container');
        const settings = StorageManager.getSettings();
        const stats = StorageManager.getStats();

        // ナビアクティブ状態をリセット
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        document.getElementById('screen-title').textContent = '設定';

        container.innerHTML = `
            <div class="settings-section">
                <h3><i class="fas fa-key"></i> API設定</h3>
                <div class="card">
                    <div class="input-group">
                        <label>Gemini API キー</label>
                        <input type="text" id="settings-api-key" value="${escapeHtml(settings.geminiApiKey)}" placeholder="AI自動取得に必要です">
                    </div>
                    <button id="save-settings-btn" class="btn-primary">
                        <i class="fas fa-save"></i> 設定を保存
                    </button>
                </div>
            </div>

            <div class="settings-section">
                <h3><i class="fab fa-google-drive"></i> Google Drive 同期</h3>
                <div class="card" style="animation-delay: 0.06s;">
                    <div class="input-group">
                        <label>Apps Script URL</label>
                        <input type="text" id="settings-script-url" value="${escapeHtml(DriveSync.getScriptUrl())}" placeholder="Google Apps ScriptのデプロイURL">
                    </div>
                    <button id="save-script-url-btn" class="btn-outline mb-12" style="width:100%;">
                        <i class="fas fa-link"></i> URLを保存
                    </button>
                    <p class="text-xs text-muted mb-12">最終同期: ${DriveSync.formatLastSync()}</p>
                    <div class="flex-row mb-12">
                        <button id="backup-btn" class="btn-primary flex-1" style="font-size:0.85rem;">
                            <i class="fas fa-cloud-arrow-up"></i> バックアップ
                        </button>
                        <button id="restore-btn" class="btn-outline flex-1" style="font-size:0.85rem;">
                            <i class="fas fa-cloud-arrow-down"></i> 復元
                        </button>
                    </div>
                    <p class="text-xs text-muted">
                        設定手順は<a href="https://script.google.com" target="_blank" rel="noopener" style="color:var(--accent);">Google Apps Script</a>でプロジェクトを作成し、コードを貼り付けてデプロイしてください。
                    </p>
                </div>
            </div>

            <div class="settings-section">
                <h3><i class="fas fa-database"></i> データ管理</h3>
                <div class="card" style="animation-delay: 0.1s;">
                    <p class="text-sm text-muted mb-12">
                        登録語数: ${stats.total}語（単語: ${stats.words} / 熟語: ${stats.phrases}）
                    </p>
                    <button id="export-btn" class="btn-outline mb-12" style="width:100%;">
                        <i class="fas fa-download"></i> データをエクスポート
                    </button>
                    <div class="input-group">
                        <label>データインポート</label>
                        <textarea id="import-data" rows="3" placeholder="エクスポートしたJSONを貼り付け"></textarea>
                    </div>
                    <button id="import-btn" class="btn-outline mb-12" style="width:100%;">
                        <i class="fas fa-upload"></i> インポート実行
                    </button>
                    <button id="clear-btn" class="btn-danger" style="width:100%;">
                        <i class="fas fa-trash"></i> 全データ削除
                    </button>
                </div>
            </div>
        `;

        // 設定保存
        document.getElementById('save-settings-btn').addEventListener('click', () => {
            StorageManager.saveSettings({
                geminiApiKey: document.getElementById('settings-api-key').value
            });
            showToast('✅ 設定を保存しました');
        });

        // Drive同期URL保存
        document.getElementById('save-script-url-btn').addEventListener('click', () => {
            DriveSync.setScriptUrl(document.getElementById('settings-script-url').value.trim());
            showToast('✅ 同期URLを保存しました');
        });

        // バックアップ
        document.getElementById('backup-btn').addEventListener('click', async () => {
            if (!DriveSync.getScriptUrl()) {
                return showToast('同期URLを先に設定してください');
            }
            showLoading(true);
            try {
                await DriveSync.backup();
                showToast('✅ バックアップ完了');
                showSettings(); // 最終同期日時を更新表示
            } catch (e) {
                showToast('❌ ' + e.message);
            } finally {
                showLoading(false);
            }
        });

        // 復元
        document.getElementById('restore-btn').addEventListener('click', async () => {
            if (!DriveSync.getScriptUrl()) {
                return showToast('同期URLを先に設定してください');
            }
            if (!confirm('クラウドのデータで上書きしますか？')) return;
            showLoading(true);
            try {
                await DriveSync.restore();
                showToast('✅ 復元完了');
                switchScreen('home');
            } catch (e) {
                showToast('❌ ' + e.message);
            } finally {
                showLoading(false);
            }
        });
        document.getElementById('export-btn').addEventListener('click', () => {
            const data = StorageManager.exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vocabmaster_backup_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('✅ エクスポート完了');
        });

        // インポート
        document.getElementById('import-btn').addEventListener('click', () => {
            const jsonStr = document.getElementById('import-data').value.trim();
            if (!jsonStr) return showToast('JSONデータを貼り付けてください');

            if (StorageManager.importData(jsonStr)) {
                showToast('✅ インポート完了');
                switchScreen('home');
            } else {
                showToast('❌ インポートに失敗しました');
            }
        });

        // データ削除
        document.getElementById('clear-btn').addEventListener('click', () => {
            if (confirm('全データを削除しますか？この操作は取り消せません。')) {
                StorageManager.clearAllData();
                showToast('全データを削除しました');
                switchScreen('home');
            }
        });
    }

    // =============================================
    // ユーティリティ
    // =============================================
    function showLoading(show) {
        document.getElementById('loading-overlay').classList.toggle('hidden', !show);
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2500);
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeQuotes(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    return { init, switchScreen };
})();

// 起動
document.addEventListener('DOMContentLoaded', App.init);
