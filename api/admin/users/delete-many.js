import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ADMIN_EMAILS 배열 - 참조용으로 남겨둠
// const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];

export default async function handler(req, res) {
  // POST 요청 확인 (인증 체크 제거)
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 인증 체크 임시 제거
  // const userEmail = req.headers['user-email'];
  // if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
  //   return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  // }

  try {
    const { emails } = req.body || {};
    
    // 이메일 목록 유효성 검사
    if (!Array.isArray(emails) || !emails.length) {
      return res.status(400).json({ message: 'emails array required' });
    }
    
    // 이메일 목록을 쿼리 파라미터로 사용
    const emailList = emails.map(email => `'${email}'`).join(',');
    const query = `UPDATE users SET deleted = true, deleted_at = NOW() WHERE email IN (${emailList})`;
    
    const result = await pool.query(query);
    return res.status(200).json({ ok: true, count: result.rowCount });
  } catch (error) {
    console.error('일괄 삭제 중 오류 발생:', error);
    return res.status(500).json({
      message: '일괄 삭제 중 서버 오류가 발생했습니다',
      error: error.message
    });
  }
} 