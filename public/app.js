document.addEventListener('DOMContentLoaded', () => {
    // 인증 관련 요소
    const loginModal = document.getElementById('login-modal');
    const guestLoginBtn = document.getElementById('guest-login-btn');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authIdInput = document.getElementById('auth-id');
    const userDisplayName = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');

    // 채팅 관련 요소
    const chatMessages = document.getElementById('chat-messages');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const modelSelect = document.getElementById('model-select');
    const chatHistoryList = document.getElementById('chat-history');
    const newChatBtn = document.getElementById('new-chat-btn');

    // 설정 관련 요소
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const apiKeyInput = document.getElementById('api-key-input');
    const settingTitleKo = document.getElementById('setting-title-ko');
    const appTitle = document.getElementById('app-title');
    const pageTitle = document.getElementById('page-title');
    const settingTone = document.getElementById('setting-tone');

    // 세션 상태 관리
    let sessions = JSON.parse(localStorage.getItem('gpt_sessions')) || [
        { id: '1', title: '새 대화', messages: [{ sender: 'ai', text: '안녕하세요! 무엇을 도와드릴까요?' }] }
    ];
    let currentSessionId = sessions[0].id;

    // 초기 로그인 상태 체크
    const savedUser = localStorage.getItem('gpt_username');
    if (savedUser) {
        loginModal.classList.add('hidden');
        userDisplayName.textContent = `👤 ${savedUser} 님`;
    }

    // 게스트 로그인
    guestLoginBtn.addEventListener('click', () => {
        localStorage.setItem('gpt_username', '하람');
        userDisplayName.textContent = '👤 하람 님';
        loginModal.classList.add('hidden');
    });

    // 로그인 버튼
    authSubmitBtn.addEventListener('click', () => {
        const idVal = authIdInput.value.trim() || '사용자';
        localStorage.setItem('gpt_username', idVal);
        userDisplayName.textContent = `👤 ${idVal} 님`;
        loginModal.classList.add('hidden');
    });

    // 로그아웃
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('gpt_username');
        loginModal.classList.remove('hidden');
    });

    // 설정 불러오기 및 적용
    const savedApiKey = localStorage.getItem('groq_api_key') || '';
    if (savedApiKey) apiKeyInput.value = savedApiKey;
    
    const savedTitle = localStorage.getItem('gpt_title') || 'Custom GPT';
    appTitle.textContent = savedTitle;
    pageTitle.textContent = savedTitle;
    settingTitleKo.value = savedTitle;

    const savedTone = localStorage.getItem('gpt_tone') || 'polite';
    settingTone.value = savedTone;

    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    
    saveSettingsBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        const title = settingTitleKo.value.trim() || 'Custom GPT';
        const tone = settingTone.value;

        localStorage.setItem('groq_api_key', key);
        localStorage.setItem('gpt_title', title);
        localStorage.setItem('gpt_tone', tone);

        appTitle.textContent = title;
        pageTitle.textContent = title;

        settingsModal.classList.add('hidden');
        alert('환경 설정이 저장되었습니다.');
    });

    // 대화 세션 렌더링
    function renderSessions() {
        chatHistoryList.innerHTML = '';
        sessions.forEach(session => {
            const div = document.createElement('div');
            div.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
            div.innerHTML = `
                <span class="session-title" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${session.title}</span>
                <button class="delete-history" title="삭제">🗑️</button>
            `;

            // 세션 클릭 시 전환
            div.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-history')) {
                    deleteSession(session.id);
                } else {
                    switchSession(session.id);
                }
            });

            chatHistoryList.appendChild(div);
        });
        saveSessionsToStorage();
    }

    function saveSessionsToStorage() {
        localStorage.setItem('gpt_sessions', JSON.stringify(sessions));
    }

    function switchSession(id) {
        currentSessionId = id;
        renderSessions();
        renderCurrentMessages();
    }

    function deleteSession(id) {
        if (sessions.length <= 1) {
            alert('최소 하나의 대화 세션은 유지되어야 합니다.');
            return;
        }
        sessions = sessions.filter(s => s.id !== id);
        if (currentSessionId === id) {
            currentSessionId = sessions[0].id;
        }
        renderSessions();
        renderCurrentMessages();
    }

    // 새 채팅 생성
    newChatBtn.addEventListener('click', () => {
        const newId = 'session_' + Date.now();
        sessions.unshift({
            id: newId,
            title: '새 대화',
            messages: [{ sender: 'ai', text: '안녕하세요! 무엇을 도와드릴까요?' }]
        });
        currentSessionId = newId;
        renderSessions();
        renderCurrentMessages();
    });

    function renderCurrentMessages() {
        chatMessages.innerHTML = '';
        const currentSession = sessions.find(s => s.id === currentSessionId);
        if (!currentSession) return;

        currentSession.messages.forEach(msg => {
            appendMessageNode(msg.text, msg.sender);
        });
    }

    function appendMessageNode(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = text;
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 메시지 전송 처리
    const handleSendMessage = async () => {
        const text = promptInput.value.trim();
        const apiKey = apiKeyInput.value.trim() || localStorage.getItem('groq_api_key');
        const selectedModel = modelSelect.value;
        const tone = localStorage.getItem('gpt_tone') || 'polite';

        if (!text) return;

        if (!apiKey) {
            alert('환경 설정에서 Groq API Key를 먼저 입력해주세요.');
            settingsModal.classList.remove('hidden');
            return;
        }

        // 현재 세션에 사용자 메시지 추가
        const currentSession = sessions.find(s => s.id === currentSessionId);
        currentSession.messages.push({ sender: 'user', text: text });

        // 첫 질문일 경우 세션 제목 변경
        if (currentSession.title === '새 대화') {
            currentSession.title = text.length > 15 ? text.substring(0, 15) + '...' : text;
        }

        renderSessions();
        renderCurrentMessages();
        promptInput.value = '';

        // 로딩 메시지 추가
        currentSession.messages.push({ sender: 'ai loading', text: 'AI가 답변을 생성 중입니다...' });
        renderCurrentMessages();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-groq-api-key': apiKey
                },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt: text,
                    tone: tone
                })
            });

            const data = await response.json();
            
            // 로딩 메시지 제거
            currentSession.messages = currentSession.messages.filter(m => m.sender !== 'ai loading');

            if (response.ok) {
                currentSession.messages.push({ sender: 'ai', text: data.reply });
            } else {
                currentSession.messages.push({ sender: 'ai error', text: `[오류]: ${data.error}` });
            }
            renderCurrentMessages();
            renderSessions();
        } catch (error) {
            currentSession.messages = currentSession.messages.filter(m => m.sender !== 'ai loading');
            currentSession.messages.push({ sender: 'ai error', text: `[네트워크 오류]: ${error.message}` });
            renderCurrentMessages();
        }
    };

    sendBtn.addEventListener('click', handleSendMessage);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // 초기 렌더링
    renderSessions();
    renderCurrentMessages();
});