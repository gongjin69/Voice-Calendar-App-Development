import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// 관리자 이메일 목록 - 참조용으로 남겨둠
// const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];

export default async function handler(req, res) {
  // GET만 허용 (인증 체크 제거)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    // Raw SQL 쿼리로 변경
    const users = await prisma.$queryRaw`SELECT * FROM "users" ORDER BY "created_at" DESC`;
    res.status(200).json(users);
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.', 
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack 
    });
  }
} 