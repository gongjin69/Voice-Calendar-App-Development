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
  // 관리자 권한 확인
  const userEmail = req.headers['user-email'];
  if (!isAdmin(userEmail)) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }

  // GET 요청 처리 - 사용자 목록 조회
  if (req.method === 'GET') {
    try {
      const users = await prisma.$queryRaw`SELECT * FROM "users" ORDER BY "created_at" DESC`;
      return res.status(200).json(users);
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
    }
  }

  return res.status(405).json({ error: '지원되지 않는 메서드입니다.' });
} 