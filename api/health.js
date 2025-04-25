// api/health.js
export default function handler(req, res) {
  res.json({
    ok: true,            // 프런트 기존 로직 호환용
    status: 'ok',        // 새 구조
    timestamp: Date.now()
  });
} 