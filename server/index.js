const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const prisma = new PrismaClient();

// __dirname 설정 (CommonJS 환경)
const __dirname = path.dirname(require.main.filename);
const distPath = path.resolve(__dirname, '../dist');

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(distPath));

// 관리자 이메일 목록
const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];

// 관리자 권한 확인 미들웨어
const checkAdmin = (req, res, next) => {
  const userEmail = req.headers['user-email'];
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
};

// 상태 확인 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// 사용자 승인 상태 확인
app.get('/api/users/approval-status/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    const requestExists = await prisma.accessRequest.findFirst({
      where: { 
        email,
        status: 'PENDING'
      }
    });
    
    res.json({
      isApproved: user?.isApproved || false,
      requestExists: !!requestExists
    });
  } catch (error) {
    console.error('사용자 승인 상태 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 접근 요청 생성
app.post('/api/access-requests', async (req, res) => {
  const { email, name } = req.body;
  
  try {
    const existingRequest = await prisma.accessRequest.findFirst({
      where: { 
        email,
        status: 'PENDING'
      }
    });
    
    if (existingRequest) {
      return res.status(400).json({ error: '이미 접근 요청이 존재합니다.' });
    }
    
    await prisma.accessRequest.create({
      data: {
        email,
        name,
        status: 'PENDING'
      }
    });
    
    res.status(201).json({ message: '접근 요청이 생성되었습니다.' });
  } catch (error) {
    console.error('접근 요청 생성 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 모든 사용자 목록 조회
app.get('/api/users', checkAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 접근 요청 목록 조회
app.get('/api/access-requests', checkAdmin, async (req, res) => {
  try {
    const requests = await prisma.accessRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    console.error('접근 요청 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 접근 요청 승인
app.post('/api/access-requests/:id/approve', checkAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const request = await prisma.accessRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!request) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    }

    // 트랜잭션으로 요청 승인 및 사용자 생성/업데이트
    await prisma.$transaction([
      prisma.accessRequest.update({
        where: { id: parseInt(id) },
        data: { status: 'APPROVED' }
      }),
      prisma.user.upsert({
        where: { email: request.email },
        create: {
          email: request.email,
          name: request.name,
          isApproved: true
        },
        update: {
          isApproved: true
        }
      })
    ]);

    res.json({ message: '접근 요청이 승인되었습니다.' });
  } catch (error) {
    console.error('접근 요청 승인 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// SPA를 위한 catch-all 라우트
app.get('*', (req, res) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

// 서버 시작
app.listen(port, '0.0.0.0', () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
}); 