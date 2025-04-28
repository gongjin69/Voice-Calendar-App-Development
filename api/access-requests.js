// api/access-requests.js
export default function handler(req, res) {
  // 기본 GET 요청 처리
  if (req.method === 'GET') {
    return res.status(200).json({
      message: 'Access requests API is working',
      data: [], // 빈 요청 목록
      timestamp: Date.now()
    });
  }
  
  // POST 요청 처리 - 접근 요청 생성
  if (req.method === 'POST') {
    const { email, name } = req.body || {};
    
    if (!email || !name) {
      return res.status(400).json({
        error: '이메일과 이름이 필요합니다',
        timestamp: Date.now()
      });
    }
    
    return res.status(201).json({
      message: '접근 요청이 생성되었습니다 (모의 응답)',
      data: { email, name, status: 'PENDING' },
      timestamp: Date.now()
    });
  }
  
  // 지원되지 않는 메서드
  return res.status(405).json({
    error: '지원되지 않는 메서드입니다',
    method: req.method,
    timestamp: Date.now()
  });
} 