import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 관리자 이메일 목록 - 참조용으로 남겨둠
// const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];

export default async function handler(req, res) {
  // GET만 허용
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    console.log('데이터베이스 URL:', process.env.DATABASE_URL); // 연결 문자열 로깅 (디버깅용)
    const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.', 
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack 
    });
  }
} 