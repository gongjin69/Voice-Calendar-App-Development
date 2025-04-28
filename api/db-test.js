export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    test: 1,
    timestamp: Date.now(),
    message: 'Simple test without DB connection'
  });
} 