document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const modelSelect = document.getElementById('model-select');
    
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const apiKeyInput = document.getElementById('api-key-input');

    // 로컬 스토리지에서 API 키 불러오기
    const savedApiKey = localStorage.getItem('groq_api_key') || '';
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    // 설정 모달 열기/닫기
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    saveSettingsBtn.addEventListener('click', () => {
        localStorage.setItem('groq_api_key', apiKeyInput.value.trim());
        settingsModal.classList.add('hidden');
        alert('API 키가 저장되었습니다.');
    });

    // 메시지 전송 함수
    const handleSendMessage = async () => {
        const text = promptInput.value.trim();
        const apiKey = apiKeyInput.value.trim() || localStorage.getItem('groq_api_key');
        const selectedModel = modelSelect.value;

        if (!text) return;

        if (!apiKey) {
            alert('우측 상단 [환경 설정]에서 Groq API Key를 먼저 입력해주세요.');
            settingsModal.classList.remove('hidden');
            return;
        }

        // 사용자 메시지 UI 추가
        appendMessage(text, 'user');
        promptInput.value = '';

        // AI 로딩 메시지 추가
        const loadingId = appendMessage('AI가 답변을 생성 중입니다...', 'ai loading');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-groq-api-key': apiKey
                },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt: text
                })
            });

            const data = await response.json();
            removeMessage(loadingId);

            if (response.ok) {
                appendMessage(data.reply, 'ai');
            } else {
                appendMessage(`[Groq API 오류]: ${data.error || '알 수 없는 오류가 발생했습니다.'}`, 'ai error');
            }
        } catch (error) {
            removeMessage(loadingId);
            appendMessage(`[네트워크 오류]: ${error.message}`, 'ai error');
        }
    };

    sendBtn.addEventListener('click', handleSendMessage);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    function appendMessage(text, sender) {
        const messageDiv = document.createElement('div');
        const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        messageDiv.id = messageId;
        messageDiv.className = `message ${sender}-message`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = text;

        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return messageId;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
});