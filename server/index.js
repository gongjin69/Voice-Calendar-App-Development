import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import adminRoutes from './routes/admin.js';
import emailRoutes from './routes/email.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../dist')));

// API 라우트
app.use('/api/admin', adminRoutes);
app.use('/api/email', emailRoutes);

// 상태 확인 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// SPA를 위한 catch-all 라우트
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// 서버 시작
app.listen(port, '0.0.0.0', () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
}); 