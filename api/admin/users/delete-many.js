import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default async function handler(req, res) {
  // POST만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    const { emails } = req.body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails array required' });
    }

    const result = await prisma.user.deleteMany({
      where: { email: { in: emails } }
    });

    res.status(200).json({ 
      count: result.count,
      message: `${result.count}명의 사용자가 삭제되었습니다.`
    });
  } catch (error) {
    console.error('다수 사용자 삭제 실패:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.', 
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack 
    });
  }
} 