import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }
  try {
    const users = await prisma.user.findMany({ 
      orderBy: { created_at: "desc" },
      where: { deleted: false }
    });
    res.status(200).json(users);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "서버 오류", message: e.message });
  }
} 