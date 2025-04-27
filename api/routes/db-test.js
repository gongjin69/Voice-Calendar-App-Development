import express from 'express';

const router = express.Router();

// DB 테스트 엔드포인트
router.get('/', (req, res) => {
  res.json({ test: 1, now: new Date().toISOString() });
});

export default router; 