import express from 'express';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// 이메일 전송을 위한 트랜스포터 설정
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// 이메일 발송 라우트
router.post('/send-email', async (req, res) => {
  const { to, subject, text } = req.body;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    });

    res.json({ message: '이메일이 성공적으로 발송되었습니다.' });
  } catch (error) {
    console.error('이메일 발송 실패:', error);
    res.status(500).json({ error: '이메일 발송에 실패했습니다.' });
  }
});

// 이메일을 통한 승인 처리
router.post('/approve-by-email', async (req, res) => {
  const { userEmail, approvalToken } = req.body;
  
  // 토큰 검증
  if (approvalToken !== process.env.EMAIL_APPROVAL_TOKEN) {
    return res.status(403).json({ error: '유효하지 않은 승인 토큰입니다.' });
  }

  try {
    // 사용자 승인 처리
    await prisma.user.update({
      where: { email: userEmail },
      data: { isApproved: true }
    });

    // 승인 완료 이메일 발송
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Voice Calendar 접근 승인 완료',
      text: `
        안녕하세요,
        
        Voice Calendar 서비스 접근이 승인되었습니다.
        지금부터 서비스를 이용하실 수 있습니다.
        
        감사합니다.
      `
    });

    res.json({ message: '사용자가 성공적으로 승인되었습니다.' });
  } catch (error) {
    console.error('이메일 승인 처리 실패:', error);
    res.status(500).json({ error: '승인 처리 중 오류가 발생했습니다.' });
  }
});

export default router; 