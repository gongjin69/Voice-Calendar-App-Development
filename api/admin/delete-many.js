import { PrismaClient } from '@prisma/client';

// Prisma 클라이언트 초기화
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// ADMIN_EMAILS 배열 - 관리자 이메일 목록
const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];

export default async function handler(req, res) {
  // POST 요청 확인
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 관리자 권한 확인
  const userEmail = req.headers['user-email'];
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }

  try {
    const { emails } = req.body || {};
    
    // 이메일 목록 유효성 검사
    if (!Array.isArray(emails) || !emails.length) {
      return res.status(400).json({ message: 'emails array required' });
    }
    
    // SQL 쿼리로 직접 실행
    const emailsString = emails.map(email => `'${email}'`).join(',');
    await prisma.$executeRaw`UPDATE "users" SET "deleted" = true, "deleted_at" = ${new Date()} WHERE "email" IN (${prisma.raw(emailsString)})`;
    
    return res.status(200).json({ ok: true, count: emails.length });
  } catch (error) {
    console.error('일괄 삭제 중 오류 발생:', error);
    return res.status(500).json({
      message: '일괄 삭제 중 서버 오류가 발생했습니다',
      error: error.message
    });
  }
} 