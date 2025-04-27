import { PrismaClient } from '@prisma/client';

// Prisma 클라이언트 초기화
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export default async function handler(req, res) {
  try {
    // 데이터베이스 연결 테스트 - 간단한 쿼리 실행
    const result = await prisma.$queryRaw`SELECT NOW()`;
    
    // 성공 응답
    res.status(200).json({
      ok: true,
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
      result: result
    });
  } catch (error) {
    console.error('데이터베이스 연결 실패:', error);
    
    // 오류 응답
    res.status(500).json({
      ok: false,
      message: 'Database connection failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 