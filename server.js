require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const { OpenAI } = require('openai');

const app = express();

const openai = new OpenAI({ 
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "My Custom GPT"
    }
});

const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: Infinity } 
});

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.static('public'));

const db = new sqlite3.Database('./gpt_app.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT UNIQUE,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        title TEXT,
        model TEXT,
        messages TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        user_id INTEGER PRIMARY KEY,
        site_name_ko TEXT,
        site_name_en TEXT,
        speak_style TEXT,
        site_lang TEXT,
        reply_lang TEXT,
        theme_type TEXT,
        custom_theme_bg TEXT
    )`);
});

app.post('/api/signup', (req, res) => {
    const { nickname, password, passwordConfirm } = req.body;

    if (!nickname || !password) {
        return res.status(400).json({ error: '닉네임과 비밀번호를 입력해주세요.' });
    }
    if (password !== passwordConfirm) {
        return res.status(400).json({ error: '비밀번호 확인이 일치하지 않습니다.' });
    }

    const pwRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
    if (!pwRegex.test(password)) {
        return res.status(400).json({ error: '비밀번호는 한글을 사용할 수 없으며 영문, 숫자, 특수문자만 가능합니다.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run('INSERT INTO users (nickname, password) VALUES (?, ?)', [nickname, hashedPassword], function(err) {
        if (err) {
            return res.status(400).json({ error: '이미 존재하는 닉네임입니다.' });
        }
        res.json({ success: true, userId: this.lastID, nickname });
    });
});

app.post('/api/login', (req, res) => {
    const { nickname, password } = req.body;
    db.get('SELECT * FROM users WHERE nickname = ?', [nickname], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.password)) {
            return res.status(400).json({ error: '닉네임 또는 비밀번호가 올바르지 않습니다.' });
        }
        res.json({ success: true, userId: user.id, nickname: user.nickname });
    });
});

// -------------------------------------------------------------
// AI 대화 API (단계별 100% 무료 모델 보장 및 자동 안전처리)
// -------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
    const { message, modelTier, speakStyle, replyLang, history } = req.body;

    // 단계별 최신 무료 AI 모델 리스트 (1순위가 원활하지 않을 경우 2순위로 안정적 처리)
    const modelCandidatesMap = {
        'easy': [
            'google/gemini-2.0-flash-lite-preview-02-05:free',
            'meta-llama/llama-3.2-3b-instruct:free',
            'openrouter/free'
        ],
        'medium': [
            'meta-llama/llama-3.1-8b-instruct:free',
            'mistralai/mistral-7b-instruct:free',
            'google/gemma-2-9b-it:free',
            'openrouter/free'
        ],
        'complex': [
            'qwen/qwen-2.5-coder-32b-instruct:free',
            'google/gemini-2.0-flash-thinking-exp:free',
            'openrouter/free'
        ]
    };

    const candidates = modelCandidatesMap[modelTier] || modelCandidatesMap['easy'];

    const systemPrompt = `You are an advanced AI assistant. 
- Tone/Style: ${speakStyle || '친절하고 명확하게'}
- Target Response Language: Automatically detect user language and adapt seamlessly.
- Always answer naturally, fast, and accurately.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...(history || []),
        { role: 'user', content: message }
    ];

    let lastError = null;

    for (const model of candidates) {
        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: messages
            });

            if (response.choices && response.choices[0] && response.choices[0].message) {
                return res.json({ reply: response.choices[0].message.content });
            }
        } catch (error) {
            console.warn(`[모델 전환 진행] ${model} 오류: ${error.message}`);
            lastError = error;
        }
    }

    res.status(500).json({ error: `AI 응답 실패: ${lastError ? lastError.message : '모든 모델에 접근할 수 없습니다.'}` });
});

// -------------------------------------------------------------
// 세션 관련 API (저장, 조회, 삭제)
// -------------------------------------------------------------
app.post('/api/sessions/save', (req, res) => {
    const { sessionId, userId, title, model, messages } = req.body;
    const msgStr = JSON.stringify(messages || []);

    db.run(`INSERT INTO sessions (id, user_id, title, model, messages, updated_at) 
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            model = excluded.model,
            messages = excluded.messages,
            updated_at = CURRENT_TIMESTAMP`,
    [sessionId, userId, title, model, msgStr], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/sessions/:userId', (req, res) => {
    db.all('SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC', [req.params.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ sessions: rows.map(r => ({ ...r, messages: JSON.parse(r.messages) })) });
    });
});

// 세션 개별 삭제 API
app.delete('/api/sessions/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    db.run('DELETE FROM sessions WHERE id = ?', [sessionId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/settings/save', (req, res) => {
    const { userId, siteNameKo, siteNameEn, speakStyle, siteLang, replyLang, themeType, customThemeBg } = req.body;
    db.run(`INSERT INTO settings (user_id, site_name_ko, site_name_en, speak_style, site_lang, reply_lang, theme_type, custom_theme_bg)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
            site_name_ko = excluded.site_name_ko,
            site_name_en = excluded.site_name_en,
            speak_style = excluded.speak_style,
            site_lang = excluded.site_lang,
            reply_lang = excluded.reply_lang,
            theme_type = excluded.theme_type,
            custom_theme_bg = excluded.custom_theme_bg`,
    [userId, siteNameKo, siteNameEn, speakStyle, siteLang, replyLang, themeType, customThemeBg], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/settings/:userId', (req, res) => {
    db.get('SELECT * FROM settings WHERE user_id = ?', [req.params.userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ settings: row || {} });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버가 http://localhost:${PORT} 에서 정상 실행 중입니다.`));