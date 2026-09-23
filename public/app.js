document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const imageFileInput = document.getElementById('image-file-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const modelSelect = document.getElementById('model-select');
    
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const apiKeyInput = document.getElementById('api-key-input');

    let base64Image = null;

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

    // 이미지 파일 선택 시 처리
    imageFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                base64Image = reader.result;
                imagePreview.src = base64Image;
                imagePreviewContainer.classList.remove('hidden');
            };
        }
    });

    // 이미지 미리보기 취소
    removeImageBtn.addEventListener('click', () => {
        base64Image = null;
        imageFileInput.value = '';
        imagePreview.src = '';
        imagePreviewContainer.classList.add('hidden');
    });

    // 메시지 전송 함수
    const handleSendMessage = async () => {
        const text = promptInput.value.trim();
        const apiKey = apiKeyInput.value.trim() || localStorage.getItem('groq_api_key');
        const selectedModel = modelSelect.value;

        if (!text && !base64Image) return;

        // API 키가 없으면 먼저 설정창 띄우기 (텍스트 지워지지 않음)
        if (!apiKey) {
            alert('우측 상단 [환경 설정]에서 Groq API Key를 먼저 입력해주세요.');
            settingsModal.classList.remove('hidden');
            return;
        }

        // 사용자 메시지 UI 추가
        appendMessage(text, 'user', base64Image);

        // 입력창 초기화
        promptInput.value = '';
        const currentImage = base64Image;
        base64Image = null;
        imageFileInput.value = '';
        imagePreviewContainer.classList.add('hidden');

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
                    prompt: text,
                    image: currentImage
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

    function appendMessage(text, sender, imageUrl = null) {
        const messageDiv = document.createElement('div');
        const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36.substr(2, 9));
        messageDiv.id = messageId;
        messageDiv.className = `message ${sender}-message`;

        let contentHtml = '';
        if (imageUrl) {
            contentHtml += `<div class="message-image"><img src="${imageUrl}" alt="첨부 이미지"></div>`;
        }
        if (text) {
            contentHtml += `<div class="message-content">${escapeHtml(text)}</div>`;
        }

        messageDiv.innerHTML = contentHtml;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return messageId;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
});