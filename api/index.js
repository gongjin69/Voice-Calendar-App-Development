// api/index.js - Simplified serverless handler
export default function handler(req, res) {
  res.status(200).json({
    message: 'Voice Calendar API',
    version: '1.0.0',
    timestamp: Date.now(),
    endpoints: [
      '/api/health',
      '/api/db-test',
      '/api/users',
      '/api/access-requests',
      '/api/admin/users'
    ]
  });
}