const express = require('express');
const cors = require('cors');
const app = express();

// CORS 설정
app.use(cors());

// JSON 파싱 미들웨어
app.use(express.json());

// 기본 라우트
app.get('/', (req, res) => {
  res.send('Voice Calendar App Server is running');
});

// 헬스 체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// 서버 포트 설정
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 