import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];

const AdminDashboard = ({ userEmail }) => {
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return;
    }
    fetchUsers();
    fetchRequests();
  }, [userEmail]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/access-requests`);
      setRequests(response.data);
    } catch (error) {
      console.error('접근 요청 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/access-requests/${requestId}/approve`);
      fetchRequests();
      fetchUsers();
    } catch (error) {
      console.error('요청 승인 실패:', error);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('정말 이 사용자를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/api/users/${userId}`);
      fetchUsers();
    } catch (error) {
      console.error('사용자 삭제 실패:', error);
    }
  };

  if (!ADMIN_EMAILS.includes(userEmail)) {
    return null;
  }

  if (loading) {
    return <div className="admin-loading">로딩 중...</div>;
  }

  return (
    <div className="admin-dashboard">
      <h2>관리자 대시보드</h2>
      
      <section className="access-requests">
        <h3>접근 요청 목록</h3>
        {requests.length === 0 ? (
          <p>새로운 접근 요청이 없습니다.</p>
        ) : (
          <div className="requests-list">
            {requests.map((request) => (
              <div key={request.id} className="request-item">
                <div className="request-info">
                  <p><strong>이메일:</strong> {request.email}</p>
                  <p><strong>이름:</strong> {request.name}</p>
                  <p><strong>요청일:</strong> {new Date(request.requestDate).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleApproveRequest(request.id)}
                  className="approve-button"
                >
                  승인하기
                </button>
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
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.phone || '-'}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>{new Date(user.lastLoginAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="delete-button"
                    >
                      삭제
                    </button>
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