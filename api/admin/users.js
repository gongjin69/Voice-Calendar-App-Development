// api/admin/users.js
export default function handler(req, res) {
  // 간단한 관리자 체크 (실제 환경에서는 더 안전한 인증 사용 필요)
  const userEmail = req.headers['user-email'];
  if (!userEmail) {
    return res.status(401).json({ 
      error: '인증되지 않은 요청입니다',
      timestamp: Date.now()
    });
  }
  
  // GET 요청 처리 - 사용자 목록 조회
  if (req.method === 'GET') {
    // 모의 사용자 데이터
    const mockUsers = [
      { id: 1, email: 'user1@example.com', name: '사용자1', status: '활성' },
      { id: 2, email: 'user2@example.com', name: '사용자2', status: '대기중' },
    ];
    
    return res.status(200).json({
      users: mockUsers,
      count: mockUsers.length,
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