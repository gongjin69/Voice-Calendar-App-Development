import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];

/**
 * @typedef {Object} UserSummary
 * @property {string} email - 사용자 이메일
 * @property {string} name - 사용자 이름
 * @property {string} requestDate - 요청 날짜
 * @property {boolean} isApproved - 승인 여부
 * @property {boolean} deleted - 삭제 여부
 */

const AdminDashboard = ({ userEmail }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return;
    }
    fetchUsers();
  }, [userEmail]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://ewc-voice-calendar-app.vercel.app';
      const response = await axios.get(`${baseUrl}/api/admin/users`);
      
      // 응답 데이터가 배열인지 확인하고 처리
      const userData = response.data;
      const usersArray = Array.isArray(userData) ? userData : Object.values(userData);
      
      setUsers(usersArray);
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
      setError('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproval = async (email, approve) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://ewc-voice-calendar-app.vercel.app';
      await axios.post(`${baseUrl}/api/admin/approve-user`, {
        email,
        approved: approve
      });

      // 상태 업데이트
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.email === email 
            ? { ...user, isApproved: approve }
            : user
        )
      );

      alert(`사용자 ${approve ? '승인' : '거부'}가 완료되었습니다.`);
    } catch (error) {
      console.error('사용자 승인/거부 실패:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  const softDelete = async (email) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://ewc-voice-calendar-app.vercel.app';
      await axios.delete(`${baseUrl}/api/admin/users/${email}`);
      
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.email === email 
            ? { ...user, deleted: true }
            : user
        )
      );
      
      alert('사용자가 삭제되었습니다.');
    } catch (error) {
      console.error('사용자 삭제 실패:', error);
      alert('삭제 처리 중 오류가 발생했습니다.');
    }
  };

  const restoreUser = async (email) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://ewc-voice-calendar-app.vercel.app';
      await axios.post(`${baseUrl}/api/admin/users/${email}/restore`);
      
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.email === email 
            ? { ...user, deleted: false }
            : user
        )
      );
      
      alert('사용자가 복구되었습니다.');
    } catch (error) {
      console.error('사용자 복구 실패:', error);
      alert('복구 처리 중 오류가 발생했습니다.');
    }
  };

  if (!ADMIN_EMAILS.includes(userEmail)) {
    return null;
  }

  if (isLoading) {
    return <div className="admin-loading">로딩 중...</div>;
  }

  if (error) {
    return <div className="admin-error">{error}</div>;
  }

  // 활성 사용자와 삭제된 사용자 필터링
  const activeUsers = Array.isArray(users) ? users.filter(u => !u.deleted) : [];
  const deletedUsers = Array.isArray(users) ? users.filter(u => u.deleted) : [];

  return (
    <div className="admin-dashboard">
      <h2>관리자 대시보드</h2>
      
      <section className="access-requests">
        <h3>접근 요청 목록</h3>
        {activeUsers.length === 0 ? (
          <p>새로운 접근 요청이 없습니다.</p>
        ) : (
          <div className="requests-list">
            {activeUsers.map((user) => (
              <div key={user.email} className="request-item">
                <div className="request-info">
                  <p><strong>이메일:</strong> {user.email}</p>
                  <p><strong>이름:</strong> {user.name || user.email.split('@')[0]}</p>
                  <p><strong>요청일:</strong> {new Date(user.requestDate).toLocaleString()}</p>
                </div>
                <div className="request-actions">
                  {!user.isApproved && (
                    <button
                      onClick={() => handleApproval(user.email, true)}
                      className="approve-button"
                    >
                      승인하기
                    </button>
                  )}
                  <button
                    onClick={() => softDelete(user.email)}
                    className="delete-button"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="users-list">
        <h3>사용자 목록</h3>
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>이메일</th>
                <th>전화번호</th>
                <th>가입일</th>
                <th>마지막 접속일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {(showDeleted ? deletedUsers : activeUsers).map((user) => (
                <tr key={user.email}>
                  <td>{user.name || user.email.split('@')[0]}</td>
                  <td>{user.email}</td>
                  <td>{user.phone || '-'}</td>
                  <td>{new Date(user.requestDate).toLocaleDateString()}</td>
                  <td>{new Date(user.lastLoginAt).toLocaleDateString()}</td>
                  <td>
                    {!showDeleted ? (
                      <div className="request-actions">
                        {!user.isApproved && (
                          <button
                            onClick={() => handleApproval(user.email, true)}
                            className="approve-button"
                          >
                            승인하기
                          </button>
                        )}
                        <button
                          onClick={() => softDelete(user.email)}
                          className="delete-button"
                        >
                          삭제
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => restoreUser(user.email)}
                        className="restore-button"
                      >
                        복구
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard; 