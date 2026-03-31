/**
 * ai.js - Gemini API を使った単語情報の自動取得
 * synonyms と antonyms を配列として分離して返す
 */

const AIManager = (() => {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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

        try {
            const response = await fetch(`${API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        responseMimeType: 'application/json'
                    }
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || `APIエラー (${response.status})`;
                throw new Error(errMsg);
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!textResponse) {
                throw new Error('AIからの応答が空でした');
            }

            // JSON部分を抽出（バックティック等を除去）
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('AIからのレスポンスが解析できませんでした');

            const parsed = JSON.parse(jsonMatch[0]);

            // 型を保証
            return {
                meaning: parsed.meaning || '',
                synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
                antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms : [],
                derivatives: parsed.derivatives || '',
                example: parsed.example || ''
            };
        } catch (e) {
            console.error('AI取得失敗:', e);
            throw e;
        }
    }

    return {
        fetchWordDetails
    };
})();
