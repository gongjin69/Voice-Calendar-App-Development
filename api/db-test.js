import { PrismaClient } from '@prisma/client';

// Prisma 클라이언트 초기화
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    test: 1,
    now: new Date().toISOString(),
    message: 'DB test endpoint'
  });
} 