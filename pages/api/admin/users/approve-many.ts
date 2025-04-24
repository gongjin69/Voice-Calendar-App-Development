import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST 메서드만 허용
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { emails } = req.body as { emails: string[] };
    
    // 요청 데이터 검증
    if (!Array.isArray(emails) || !emails.length) {
      return res.status(400).json({ message: '유효한 이메일 배열이 필요합니다.' });
    }

    // DB 업데이트
    await db.collection('users').updateMany(
      { email: { $in: emails } },
      { $set: { isApproved: true, updatedAt: new Date() } }
    );

    return res.status(200).json({ 
      ok: true, 
      count: emails.length,
      message: `${emails.length}명의 사용자가 승인되었습니다.`
    });
  } catch (error) {
    console.error('일괄 승인 처리 중 오류:', error);
    return res.status(500).json({ 
      message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
    });
  }
} 