const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공 (public 폴더)
app.use(express.static(path.join(__dirname, 'public')));

// 채팅 API 엔드포인트
app.post('/api/chat', async (req, res) => {
    try {
        const { model, prompt } = req.body;
        const userApiKey = req.headers['x-groq-api-key'] || process.env.GROQ_API_KEY;

        if (!userApiKey) {
            return res.status(400).json({ error: 'API Key가 제공되지 않았습니다. 설정에서 키를 입력해주세요.' });
        }

        const groq = new Groq({ apiKey: userApiKey });

        const completion = await groq.chat.completions.create({
            model: model || "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
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

// 서버 실행
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 정상 실행 중입니다.`);
});