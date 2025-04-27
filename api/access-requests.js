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
  // URL 경로의 segments 가져오기 
  const { id } = req.query;
  
  // POST /api/access-requests - 접근 요청 생성
  if (req.method === 'POST' && !id) {
    const { email, name } = req.body;
    
    try {
      const existingRequest = await prisma.accessRequest.findFirst({
        where: { 
          email,
          status: 'PENDING'
        }
      });
      
      if (existingRequest) {
        return res.status(400).json({ error: '이미 접근 요청이 존재합니다.' });
      }
      
      await prisma.accessRequest.create({
        data: {
          email,
          name,
          status: 'PENDING'
        }
      });
      
      return res.status(201).json({ message: '접근 요청이 생성되었습니다.' });
    } catch (error) {
      console.error('접근 요청 생성 실패:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
    }
  }
  
  // GET /api/access-requests - 접근 요청 목록 조회 (관리자 전용)
  if (req.method === 'GET' && !id) {
    // 관리자 권한 확인
    const userEmail = req.headers['user-email'];
    if (!isAdmin(userEmail)) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    
    try {
      const requests = await prisma.$queryRaw`SELECT * FROM "access_requests" WHERE "status" = 'PENDING' ORDER BY "created_at" DESC`;
      return res.status(200).json(requests);
    } catch (error) {
      console.error('접근 요청 목록 조회 실패:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
    }
  }
  
  // POST /api/access-requests/[id]/approve - 접근 요청 승인
  if (req.method === 'POST' && id && req.query.approve) {
    // 관리자 권한 확인
    const userEmail = req.headers['user-email'];
    if (!isAdmin(userEmail)) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    
    try {
      const request = await prisma.accessRequest.findUnique({
        where: { id: parseInt(id) }
      });
  
      if (!request) {
        return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
      }
  
      await prisma.$transaction([
        prisma.accessRequest.update({
          where: { id: parseInt(id) },
          data: { status: 'APPROVED' }
        }),
        prisma.user.upsert({
          where: { email: request.email },
          create: {
            email: request.email,
            name: request.name,
            isApproved: true
          },
          update: {
            isApproved: true
          }
        })
      ]);
  
      return res.status(200).json({ message: '접근 요청이 승인되었습니다.' });
    } catch (error) {
      console.error('접근 요청 승인 실패:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
    }
  }
  
  // 지원되지 않는 메서드 또는 경로
  return res.status(404).json({ error: '요청한 경로를 찾을 수 없습니다.' });
} 