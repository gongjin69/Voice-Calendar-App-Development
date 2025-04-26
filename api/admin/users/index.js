import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default async function handler(req, res) {
  // GET만 허용
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
} 