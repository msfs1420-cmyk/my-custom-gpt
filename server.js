const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
    try {
        const { model, prompt, tone } = req.body;
        const userApiKey = req.headers['x-groq-api-key'] || process.env.GROQ_API_KEY;

        if (!userApiKey) {
            return res.status(400).json({ error: 'API Key가 제공되지 않았습니다. 설정에서 키를 입력해주세요.' });
        }

        const groq = new Groq({ apiKey: userApiKey });

        let systemPrompt = "당신은 친절하고 정중한 AI 어시스턴트입니다.";
        if (tone === 'friendly') {
            systemPrompt = "당신은 친근하고 다정한 친구 같은 AI입니다. 반말과 편안한 어조를 사용하세요.";
        } else if (tone === 'professional') {
            systemPrompt = "당신은 전문적이고 간결하게 핵심만 전달하는 비즈니스 AI입니다.";
        }

        const completion = await groq.chat.completions.create({
            model: model || "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2048,
        });

        const reply = completion.choices[0]?.message?.content || "답변을 생성하지 못했습니다.";
        res.json({ reply });

    } catch (error) {
        console.error("Groq API Error:", error);
        res.status(500).json({ error: error.message || '서버 내부 오류가 발생했습니다.' });
    }
});

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 정상 실행 중입니다.`);
});