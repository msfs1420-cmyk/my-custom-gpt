let currentUser = null;
let currentSessionId = Date.now().toString();
let currentMessages = [];
let customBgData = '';

if ('Notification' in window) {
    Notification.requestPermission();
}

// 10초 자동 저장
setInterval(() => {
    if (currentUser && currentMessages.length > 0) {
        saveCurrentSession();
    }
}, 10000);

async function handleSignup() {
    const nickname = document.getElementById('auth-nickname').value;
    const password = document.getElementById('auth-password').value;
    const passwordConfirm = document.getElementById('auth-password-confirm').value;

    const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, password, passwordConfirm })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else { alert('회원가입 성공!'); handleLogin(); }
}

async function handleLogin() {
    const nickname = document.getElementById('auth-nickname').value;
    const password = document.getElementById('auth-password').value;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, password })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);

    currentUser = data;
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    await loadSettings();
    await loadSessions();
}

async function sendMessage() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    currentMessages.push({ role: 'user', content: text });
    input.value = '';

    const modelTier = document.getElementById('model-select').value;
    const speakStyle = document.getElementById('cfg-speak-style').value;
    const replyLang = document.getElementById('cfg-site-lang').value;

    // "생각 중..." 표시 시작
    showThinkingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                modelTier,
                speakStyle,
                replyLang,
                history: currentMessages.slice(0, -1)
            })
        });

        const data = await res.json();

        // "생각 중..." 표시 제거
        removeThinkingIndicator();

        if (data.error) {
            appendMessage('assistant', `⚠️ 오류: ${data.error}`);
            return;
        }

        if (data.reply) {
            appendMessage('assistant', data.reply);
            currentMessages.push({ role: 'assistant', content: data.reply });
            saveCurrentSession();

            if (document.hidden && Notification.permission === 'granted') {
                new Notification('GPT 답변 완료', {
                    body: data.reply.substring(0, 50) + '...'
                });
            }
        } else {
            appendMessage('assistant', '⚠️ 알 수 없는 오류가 발생했습니다.');
        }
    } catch (err) {
        removeThinkingIndicator();
        appendMessage('assistant', `⚠️ 통신 오류: ${err.message}`);
    }
}

// "생각하는 중..." 문구 표시 함수
function showThinkingIndicator() {
    removeThinkingIndicator();
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.id = 'thinking-indicator';
    div.className = 'message assistant thinking';
    div.style.fontStyle = 'italic';
    div.style.opacity = '0.8';
    div.innerText = '🤔 답변을 생각하는 중입니다...';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeThinkingIndicator() {
    const indicator = document.getElementById('thinking-indicator');
    if (indicator) indicator.remove();
}

function appendMessage(role, text) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function saveCurrentSession() {
    if (!currentUser) return;
    const title = currentMessages[0]?.content.substring(0, 15) || '새로운 세션';
    const model = document.getElementById('model-select').value;

    await fetch('/api/sessions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId: currentSessionId,
            userId: currentUser.userId,
            title,
            model,
            messages: currentMessages
        })
    });
    document.getElementById('save-status').innerText = '자동 저장 완료';
}

async function createNewSession() {
    await saveCurrentSession();
    currentSessionId = Date.now().toString();
    currentMessages = [];
    document.getElementById('chat-messages').innerHTML = '';
    loadSessions();
}

// 세션 목록 불러오기 및 삭제 버튼 구성
async function loadSessions() {
    const res = await fetch(`/api/sessions/${currentUser.userId}`);
    const data = await res.json();
    const list = document.getElementById('session-list');
    list.innerHTML = '';
    if (data.sessions) {
        data.sessions.forEach(s => {
            const item = document.createElement('div');
            item.className = 'session-item';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';

            const titleSpan = document.createElement('span');
            titleSpan.innerText = s.title;
            titleSpan.style.flex = '1';
            titleSpan.onclick = async () => {
                await saveCurrentSession();
                currentSessionId = s.id;
                currentMessages = s.messages;
                renderMessages();
            };

            const delBtn = document.createElement('button');
            delBtn.innerText = '🗑️';
            delBtn.style.background = 'none';
            delBtn.style.border = 'none';
            delBtn.style.cursor = 'pointer';
            delBtn.style.padding = '2px 6px';
            delBtn.style.fontSize = '14px';
            delBtn.title = '세션 삭제';

            delBtn.onclick = async (e) => {
                e.stopPropagation(); // 세션 전환 이벤트 방지
                const confirmDelete = confirm('정말 이 세션을 삭제하시겠습니까?');
                if (confirmDelete) {
                    await deleteSession(s.id);
                }
            };

            item.appendChild(titleSpan);
            item.appendChild(delBtn);
            list.appendChild(item);
        });
    }
}

// 세션 삭제 실행 함수
async function deleteSession(sessionId) {
    try {
        const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (currentSessionId === sessionId) {
                currentSessionId = Date.now().toString();
                currentMessages = [];
                document.getElementById('chat-messages').innerHTML = '';
            }
            await loadSessions();
        } else {
            alert('삭제에 실패했습니다.');
        }
    } catch (err) {
        alert('삭제 중 오류 발생: ' + err.message);
    }
}

function renderMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    currentMessages.forEach(m => appendMessage(m.role, m.content));
}

function handleBgPhoto(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            customBgData = e.target.result;
            applyTheme('custom');
        };
        reader.readAsDataURL(file);
    }
}

function applyTheme(type) {
    document.body.className = `${type}-theme`;
    if (type === 'custom' && customBgData) {
        document.body.style.backgroundImage = `url(${customBgData})`;
    } else {
        document.body.style.backgroundImage = 'none';
    }
}

function toggleCustomPhotoInput(val) {
    const group = document.getElementById('custom-photo-group');
    if (val === 'custom') {
        group.classList.remove('hidden');
    } else {
        group.classList.add('hidden');
        applyTheme(val);
    }
}

function openSettings() { document.getElementById('settings-modal').classList.remove('hidden'); }
async function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
    const themeType = document.getElementById('cfg-theme-type').value;
    applyTheme(themeType);

    await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser.userId,
            siteNameKo: document.getElementById('cfg-name-ko').value,
            siteNameEn: document.getElementById('cfg-name-en').value,
            speakStyle: document.getElementById('cfg-speak-style').value,
            siteLang: document.getElementById('cfg-site-lang').value,
            replyLang: document.getElementById('cfg-site-lang').value,
            themeType,
            customThemeBg: customBgData
        })
    });
}

async function loadSettings() {
    const res = await fetch(`/api/settings/${currentUser.userId}`);
    const data = await res.json();
    if (data.settings && data.settings.theme_type) {
        document.getElementById('cfg-theme-type').value = data.settings.theme_type;
        applyTheme(data.settings.theme_type);
        if (data.settings.custom_theme_bg) {
            customBgData = data.settings.custom_theme_bg;
            if (data.settings.theme_type === 'custom') applyTheme('custom');
        }
    }
}

// PC 키보드 엔터(Enter) 전송
function initEnterKeyHandler() {
    const inputArea = document.getElementById('user-input');
    if (!inputArea) return;

    inputArea.addEventListener('keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnterKeyHandler);
} else {
    initEnterKeyHandler();
}