import { PrismaClient } from '@prisma/client';

// Prisma 클라이언트 초기화
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// 관리자 이메일 목록
const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];

// 관리자 권한 확인 함수
const isAdmin = (userEmail) => {
  return userEmail && ADMIN_EMAILS.includes(userEmail);
};

export default async function handler(req, res) {
  // POST 메서드 확인
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '지원되지 않는 메서드입니다.' });
  }

  // 관리자 권한 확인
  const userEmail = req.headers['user-email'];
  if (!isAdmin(userEmail)) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }

  // 요청 본문 확인
  const { emails } = req.body || {};
  if (!Array.isArray(emails) || !emails.length) {
    return res.status(400).json({ message: 'emails array required' });
  }
  
  try {
    // 이메일 목록 문자열 생성
    const emailsString = emails.map(email => `'${email}'`).join(',');
    
    // SQL 쿼리로 직접 실행
    await prisma.$executeRaw`UPDATE "users" SET "deleted" = true, "deleted_at" = ${new Date()} WHERE "email" IN (${prisma.raw(emailsString)})`;
    
    return res.status(200).json({ ok: true, count: emails.length });
  } catch (error) {
    console.error('일괄 삭제 실패:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
} 