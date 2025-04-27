// api/health.js
import { PrismaClient } from '@prisma/client';

// Prisma 클라이언트 초기화 (옵션)
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export default function handler(req, res) {
  res.status(200).json({ 
    ok: true, 
    status: 'ok', 
    timestamp: Date.now(),
    message: 'API server is running'
  });
} 