import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();

// CORS 설정
app.use(cors());

// JSON 파싱 미들웨어
app.use(express.json());

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 헬스 체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '서버가 정상적으로 실행 중입니다.' });
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: '서버가 정상적으로 실행 중입니다.' });
});

// 관리자 정보
const ADMIN_EMAIL = 'cspark69@ewckids.com';
const KAKAO_ADMIN_KEY = process.env.KAKAO_ADMIN_KEY; // 카카오톡 관리자 키

// 액세스 요청 저장소 (실제 구현에서는 데이터베이스 사용 권장)
const accessRequests = new Map();

// Kakao message sending function
async function sendKakaoMessage(phoneNumber, message) {
  try {
    const response = await axios.post('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      template_object: {
        object_type: 'text',
        text: message,
        link: {
          web_url: 'http://localhost:5174',
          mobile_web_url: 'http://localhost:5174'
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.KAKAO_ADMIN_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data;
  } catch (error) {
    console.error('카카오톡 메시지 전송 실패:', error);
    throw error;
  }
}

// Email sending function
async function sendEmail(to, subject, text) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    });
  } catch (error) {
    console.error('이메일 전송 실패:', error);
    throw error;
  }
}

// 액세스 요청 엔드포인트
app.post('/api/request-access', async (req, res) => {
  try {
    const { email, name } = req.body;
    const requestId = Date.now().toString();
    
    // 요청 정보 저장
    accessRequests.set(requestId, {
      email,
      name,
      status: 'pending',
      timestamp: new Date()
    });

    // Send notification to admin via Kakao
    const adminMessage = `새로운 액세스 요청이 있습니다.\n이름: ${name}\n이메일: ${email}\n승인 링크: http://localhost:5174/admin/approve/${requestId}`;
    await sendKakaoMessage(process.env.ADMIN_PHONE, adminMessage);

    // Send confirmation email to user
    await sendEmail(
      email,
      '액세스 요청 접수 확인',
      `안녕하세요 ${name}님,\n\n음성 캘린더 앱 액세스 요청이 접수되었습니다. 관리자 검토 후 승인 여부를 알려드리겠습니다.\n\n감사합니다.`
    );

    res.json({ 
      success: true, 
      message: '액세스 요청이 성공적으로 전송되었습니다.' 
    });
  } catch (error) {
    console.error('액세스 요청 처리 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '액세스 요청 처리 중 오류가 발생했습니다.' 
    });
  }
});

// 액세스 요청 승인 엔드포인트
app.post('/api/approve-access', async (req, res) => {
  try {
    const { requestId, approved } = req.body;
    const request = accessRequests.get(requestId);

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: '요청을 찾을 수 없습니다.' 
      });
    }

    // Update request status
    request.status = approved ? 'approved' : 'rejected';
    accessRequests.set(requestId, request);

    // Send result email to user
    const emailSubject = approved ? '액세스 요청 승인' : '액세스 요청 거절';
    const emailText = approved
      ? `안녕하세요 ${request.name}님,\n\n음성 캘린더 앱 액세스 요청이 승인되었습니다. 이제 서비스를 이용하실 수 있습니다.\n\n감사합니다.`
      : `안녕하세요 ${request.name}님,\n\n죄송하지만 음성 캘린더 앱 액세스 요청이 거절되었습니다.\n\n감사합니다.`;

    await sendEmail(request.email, emailSubject, emailText);

    res.json({ 
      success: true, 
      message: `액세스 요청이 성공적으로 ${approved ? '승인' : '거절'}되었습니다.` 
    });
  } catch (error) {
    console.error('액세스 승인 처리 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '액세스 승인 처리 중 오류가 발생했습니다.' 
    });
  }
});

// 액세스 상태 확인 엔드포인트
app.get('/api/check-access/:email', (req, res) => {
  const { email } = req.params;
  let hasAccess = false;

  // Check if user has approved access
  for (const [_, request] of accessRequests) {
    if (request.email === email && request.status === 'approved') {
      hasAccess = true;
      break;
    }
  }

  res.json({ hasAccess });
});

// 카카오 로그인 콜백 처리
app.get('/kakao/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    // 카카오 액세스 토큰 받기
    const tokenResponse = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_API_KEY,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        code,
      },
    });

    // 카카오 사용자 정보 받기
    const userResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${tokenResponse.data.access_token}`,
      },
    });

    // 관리자 확인
    if (userResponse.data.kakao_account?.email === ADMIN_EMAIL) {
      res.redirect(`${process.env.FRONTEND_URL}/admin/dashboard`);
    } else {
      res.redirect(process.env.FRONTEND_URL);
    }
  } catch (error) {
    console.error('카카오 로그인 처리 실패:', error);
    res.redirect(`${process.env.FRONTEND_URL}/error`);
  }
});

// Get access requests endpoint
app.get('/api/access-requests', (req, res) => {
  try {
    const requestsList = Array.from(accessRequests.entries()).map(([id, request]) => ({
      id,
      ...request
    }));

    res.json({ 
      success: true, 
      requests: requestsList 
    });
  } catch (error) {
    console.error('액세스 요청 목록 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      message: '액세스 요청 목록 조회 중 오류가 발생했습니다.' 
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 