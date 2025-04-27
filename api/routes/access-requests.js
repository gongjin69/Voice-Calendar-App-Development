import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

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

// 접근 요청 생성
router.post('/', async (req, res) => {
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
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 접근 요청 목록 조회
router.get('/', checkAdmin, async (req, res) => {
  try {
    // 직접 SQL 쿼리 실행
    const requests = await prisma.$queryRaw`SELECT * FROM "access_requests" WHERE "status" = 'PENDING' ORDER BY "created_at" DESC`;
    res.json(requests);
  } catch (error) {
    console.error('접근 요청 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 접근 요청 승인
router.post('/:id/approve', checkAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const request = await prisma.accessRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!request) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    }

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
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

export default router; 