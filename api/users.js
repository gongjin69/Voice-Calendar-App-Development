import { PrismaClient } from '@prisma/client';

// Prisma 클라이언트 초기화
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export default async function handler(req, res) {
  // URL 경로의 segments 가져오기
  const { segments } = req.query;
  
  // approval-status/:email 엔드포인트 처리
  if (segments && segments[0] === 'approval-status' && segments[1]) {
    const email = segments[1];
    
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
      
      return res.status(200).json({
        isApproved: user?.isApproved || false,
        requestExists: !!requestExists
      });
    } catch (error) {
      console.error('사용자 승인 상태 조회 실패:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
    }
  }
  
  // 지원되지 않는 경로
  return res.status(404).json({ error: '요청한 경로를 찾을 수 없습니다.' });
} 