import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';

export async function POST(req: NextRequest) {
  try {
    const { emails } = await req.json() as { emails: string[] };
    
    // 요청 데이터 검증
    if (!Array.isArray(emails) || !emails.length) {
      return NextResponse.json(
        { message: '유효한 이메일 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    // DB 업데이트
    const database = await db;
    await database.collection('users').updateMany(
      { email: { $in: emails } },
      { $set: { isApproved: true, updatedAt: new Date() } }
    );

    return NextResponse.json({ 
      ok: true, 
      count: emails.length,
      message: `${emails.length}명의 사용자가 승인되었습니다.`
    });
  } catch (error) {
    console.error('일괄 승인 처리 중 오류:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
} 