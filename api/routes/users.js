import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// 사용자 승인 상태 확인
router.get('/approval-status/:email', async (req, res) => {
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
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

export default router; 