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

// 모든 사용자 목록 조회
router.get('/', checkAdmin, async (req, res) => {
  try {
    // 직접 SQL 쿼리 실행
    const users = await prisma.$queryRaw`SELECT * FROM "users" ORDER BY "created_at" DESC`;
    res.json(users);
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 일괄 승인 API
router.post('/approve-many', checkAdmin, async (req, res) => {
  const { emails } = req.body || {};
  if (!Array.isArray(emails) || !emails.length) {
    return res.status(400).json({ message: 'emails array required' });
  }
  
  try {
    // 이메일 목록 문자열 생성
    const emailsString = emails.map(email => `'${email}'`).join(',');
    
    // SQL 쿼리로 직접 실행
    await prisma.$executeRaw`UPDATE "users" SET "deleted" = false, "status" = '활성', "updated_at" = ${new Date()} WHERE "email" IN (${prisma.raw(emailsString)})`;
    
    res.json({ ok: true, count: emails.length });
  } catch (error) {
    console.error('일괄 승인 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 일괄 삭제 API
router.post('/delete-many', checkAdmin, async (req, res) => {
  const { emails } = req.body || {};
  if (!Array.isArray(emails) || !emails.length) {
    return res.status(400).json({ message: 'emails array required' });
  }
  
  try {
    // 이메일 목록 문자열 생성
    const emailsString = emails.map(email => `'${email}'`).join(',');
    
    // SQL 쿼리로 직접 실행
    await prisma.$executeRaw`UPDATE "users" SET "deleted" = true, "deleted_at" = ${new Date()} WHERE "email" IN (${prisma.raw(emailsString)})`;
    
    res.json({ ok: true, count: emails.length });
  } catch (error) {
    console.error('일괄 삭제 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

export default router; 