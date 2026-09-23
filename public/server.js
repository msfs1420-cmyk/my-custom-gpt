const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON 데이터 및 URL 인코딩 파싱 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// public 폴더 내의 정적 파일(HTML, CSS, JS 등) 서빙
app.use(express.static(path.join(__dirname, 'public')));

// 기본 루트 접속 시 index.html 반환
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`🚀 서버가 정상적으로 실행되었습니다! 접속 주소: http://localhost:${PORT}`);
});