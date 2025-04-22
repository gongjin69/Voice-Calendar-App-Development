import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Admin() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/access-requests');
      setRequests(response.data.requests);
    } catch (error) {
      console.error('요청 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId, approved) => {
    try {
      await axios.post('http://localhost:3001/api/approve-access', {
        requestId,
        approved
      });
      
      // 목록 새로고침
      fetchRequests();
      
      alert(`요청이 성공적으로 ${approved ? '승인' : '거절'}되었습니다.`);
    } catch (error) {
      console.error('승인 처리 실패:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <div>로딩 중...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>액세스 요청 관리</h1>
      
      {requests.length === 0 ? (
        <p>처리할 요청이 없습니다.</p>
      ) : (
        <div>
          {requests.map((request) => (
            <div
              key={request.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '15px',
                backgroundColor: 'white'
              }}
            >
              <h3>{request.name}</h3>
              <p>이메일: {request.email}</p>
              <p>요청 시간: {new Date(request.timestamp).toLocaleString()}</p>
              <p>상태: {
                request.status === 'pending' ? '대기 중' :
                request.status === 'approved' ? '승인됨' :
                '거절됨'
              }</p>
              
              {request.status === 'pending' && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    onClick={() => handleApproval(request.id, true)}
                    style={{
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    승인
                  </button>
                  <button
                    onClick={() => handleApproval(request.id, false)}
                    style={{
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    거절
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Admin; 