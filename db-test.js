import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// 연결 정보 출력 (비밀번호는 가림)
const dbUrl = process.env.DATABASE_URL;
const maskedUrl = dbUrl.replace(/:[^:]*@/, ':***@');
console.log('Connection string:', maskedUrl);

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

// 연결 테스트
async function testConnection() {
  try {
    // 간단한 쿼리 실행 (실제 쿼리는 DB 구조에 따라 조정)
    const count = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Connection successful!', count);
    return true;
  } catch (error) {
    console.error('Connection failed!');
    console.error('Error details:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// 테스트 실행
testConnection()
  .then(success => {
    console.log('Test completed with status:', success ? 'SUCCESS' : 'FAILURE');
    process.exit(success ? 0 : 1);
  }); 