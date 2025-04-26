import { PrismaClient } from '@prisma/client';

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

export default async function handler(req, res) {
  // POST 요청 확인
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { email } = req.body;

    // 이메일 유효성 검사
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // 사용자 복원 (소프트 삭제 상태 해제)
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { deleted: false }
    });

    return res.status(200).json({
      message: '사용자가 복원되었습니다',
      user: updatedUser
    });
  } catch (error) {
    console.error('사용자 복원 중 오류 발생:', error);
    return res.status(500).json({
      message: '사용자 복원 중 서버 오류가 발생했습니다',
      error: error.message
    });
  }
} 