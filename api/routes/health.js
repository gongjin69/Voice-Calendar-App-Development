import express from 'express';

const router = express.Router();

// 헬스 체크 엔드포인트
router.get('/', (req, res) => {
  res.json({ ok: true, status: 'ok', timestamp: Date.now() });
});

export default router; 