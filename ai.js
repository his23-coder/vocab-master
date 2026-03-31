/**
 * ai.js - Gemini API を使った単語情報の自動取得
 * 自動最適化機能: 利用可能なモデルを動的に取得し、制限エラー時にフォールバックします
 */

const AIManager = (() => {
    let activeModel = null;

    // 利用可能なモデル一覧をAPIから取得し、適切な順序に並び替える
    async function getAvailableModels(apiKey) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            throw new Error('APIキーが無効、またはGoogleのサーバーと通信できません');
        }
        const data = await response.json();
        
        // generateContentに対応しており、「flash」を含むモデルを抽出
        const models = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
            .filter(name => name.includes('flash'));
            
        // 優先度順に並び替え（無料枠が多い lite などを優先、次に新しいバージョン番号）
        return models.sort((a, b) => {
            if (a.includes('lite') && !b.includes('lite')) return -1;
            if (!a.includes('lite') && b.includes('lite')) return 1;
            return b.localeCompare(a); // 降順 (例: 2.5 -> 2.0 -> 1.5)
        });
    }

    // 指定したモデルでAPIを叩く
    async function tryFetchWithModel(modelName, apiKey, prompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `APIエラー (${response.status})`;
            // Quota(制限)系のエラーかどうかを判定
            const isQuotaError = errMsg.toLowerCase().includes('quota') || errMsg.includes('limit: 0') || response.status === 429;
            throw { message: errMsg, status: response.status, isQuotaError };
        }

        return await response.json();
    }

    async function fetchWordDetails(term) {
        const settings = StorageManager.getSettings();
        const apiKey = settings.geminiApiKey;

        if (!apiKey) {
            throw new Error('APIキーが設定されていません。\n設定画面（⚙️）から登録してください。');
        }

        const prompt = `
            以下の英単語または英熟語について、学習に必要な情報を日本語で取得してください。
            返答は必ず以下のJSON形式のみで行ってください。余計な解説文やバックティックは含めないでください。

            語句: "${term}"

            JSON形式:
            {
                "meaning": "日本語での主な意味（簡潔に）",
                "synonyms": ["同義語1", "同義語2", "同義語3"],
                "antonyms": ["対義語1", "対義語2"],
                "derivatives": "派生語や品詞変化（例: 名詞形:xxx, 形容詞形:yyy, 副詞形:zzz）",
                "example": "その語句を使った、学習に適した自然な英語の例文"
            }

            注意:
            - synonyms と antonyms は必ず配列にしてください
            - 同義語・対義語がない場合は空の配列 [] にしてください
            - 例文は英語で、実用的で自然な文にしてください
        `;

        // モデル候補のリストを取得（すでに成功したモデルがあればそれを最優先）
        let modelsToTry = [];
        if (activeModel) {
            modelsToTry = [activeModel];
        } else {
            modelsToTry = await getAvailableModels(apiKey);
            if (modelsToTry.length === 0) {
                 throw new Error('お使いのAPIキーで利用可能なAIモデルが見つかりません');
            }
        }

        let lastError = null;

        // 利用可能なモデルを順番に試す（エラー時にフォールバック）
        for (const model of modelsToTry) {
            try {
                console.log(`[AI] ${model} で取得を試行中...`);
                const data = await tryFetchWithModel(model, apiKey, prompt);
                const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (!textResponse) throw new Error('AIからの応答が空でした');

                const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error('AIからのレスポンスが解析できませんでした');

                const parsed = JSON.parse(jsonMatch[0]);
                
                // 成功したら、次回から高速化のためにこのモデルを固定で使用する
                activeModel = model;

                return {
                    meaning: parsed.meaning || '',
                    synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
                    antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms : [],
                    derivatives: parsed.derivatives || '',
                    example: parsed.example || ''
                };
            } catch (e) {
                lastError = e;
                console.warn(`[AI] ${model} 失敗:`, e.message);
                
                // アカウントの利用制限（無料枠ゼロ等）の場合は次のモデルを試す
                if (e.isQuotaError) {
                    continue; 
                }
                
                // クオータ以外の致命的なエラー（キー間違い等）は即座に終了
                throw new Error(e.message);
            }
        }

        // 全てのモデルがQuota制限に引っかかった場合
        activeModel = null; // リセット
        throw new Error(`全てのアカウント無料枠が制限（Limit: 0 / Quota exceeded）に達しています。\nGoogle AI Studioで新しいプロジェクトを作成するか、Billing（支払い）設定を確認してください。\n詳細: ${lastError.message}`);
    }

    return {
        fetchWordDetails
    };
})();
