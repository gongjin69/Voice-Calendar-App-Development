// api/users.js
export default function handler(req, res) {
  // URL 경로의 segments 가져오기
  const { segments } = req.query;
  
  // 기본 응답
  if (!segments || segments.length === 0) {
    return res.status(200).json({
      message: 'User API is working',
      timestamp: Date.now()
    });
  }
  
  // approval-status/:email 엔드포인트 처리
  if (segments[0] === 'approval-status') {
    const email = segments[1] || 'unknown';
    
    return res.status(200).json({
      message: `Mock approval status for ${email}`,
      isApproved: false,
      requestExists: false,
      timestamp: Date.now()
    });
  }
  
  // 지원되지 않는 경로
  return res.status(404).json({ 
    error: '요청한 경로를 찾을 수 없습니다.',
    path: segments.join('/')
  });
} 