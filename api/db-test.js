import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  try {
    console.log('데이터베이스 URL:', process.env.DATABASE_URL); // 연결 문자열 로깅 (디버깅용)
    const { rows } = await pool.query('SELECT 1 AS test, NOW() AS now');
    res.status(200).json(rows);
  } catch (error) {
    console.error('DB 연결 실패:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
} 