import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];

/**
 * @typedef {Object} UserSummary
 * @property {string} email - 사용자 이메일
 * @property {string} [name] - 사용자 이름 (optional)
 * @property {string} requestDate - 요청 날짜
 * @property {boolean} isApproved - 승인 여부
 * @property {boolean} deleted - 삭제 여부
 * @property {string} [phone] - 전화번호 (optional)
 * @property {string} [lastLoginAt] - 마지막 로그인 시간 (optional)
 */

const AdminDashboard = ({ userEmail }) => {
  const [users, setUsers] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (!ADMIN_EMAILS.includes(userEmail)) {
      setError('관리자 권한이 없습니다.');
      setIsLoading(false);
      return;
    }
    fetchUsers();
  }, [userEmail]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSelected(new Set()); // 선택 초기화
      
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://ewc-voice-calendar-app.vercel.app';
      const response = await axios.get(`${baseUrl}/api/admin/users`);
      
      // 응답 데이터 검증 및 처리
      const userData = response.data;
      if (!userData) {
        throw new Error('사용자 데이터를 받아오지 못했습니다.');
      }

      const usersArray = Array.isArray(userData) ? userData : Object.values(userData);
      if (!Array.isArray(usersArray)) {
        throw new Error('잘못된 데이터 형식입니다.');
      }
      
      // 필수 필드 검증
      const validUsers = usersArray.map(user => ({
        ...user,
        email: user?.email || '',
        name: user?.name || user?.email?.split('@')?.[0] || '이름 없음',
        requestDate: user?.requestDate || new Date().toISOString(),
        isApproved: Boolean(user?.isApproved),
        deleted: Boolean(user?.deleted),
        phone: user?.phone || '-',
        lastLoginAt: user?.lastLoginAt || user?.requestDate || new Date().toISOString()
      }));

      setUsers(validUsers);
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
      setError(error?.message || '사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 체크박스 핸들러
  const toggleOne = (email) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  const toggleAll = (userList) => {
    setSelected(prev =>
      prev.size === userList.length ? new Set() : new Set(userList.map(u => u.email))
    );
  };

  // 일괄 처리 함수
  const handleBulkApproval = async () => {
    if (!selected.size) return;
    
    if (!window.confirm(`선택한 ${selected.size}명의 사용자를 승인하시겠습니까?`)) {
      return;
    }

    try {
      const response = await axios.post('/api/admin/users/approve-many', {
        emails: Array.from(selected)
      });

      if (response.status === 200) {
        setUsers(prevUsers => 
          prevUsers.map(user => 
            selected.has(user.email) 
              ? { ...user, isApproved: true }
              : user
          )
        );
        
        setSelected(new Set());
        alert(`${selected.size}명의 사용자가 승인되었습니다.`);
      } else {
        throw new Error('승인 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('일괄 승인 실패:', error);
      alert(error?.response?.data?.message || '일괄 승인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    
    if (!window.confirm(`정말로 선택한 ${selected.size}명의 사용자를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await axios.post('/api/admin/users/delete-many', {
        emails: Array.from(selected)
      });

      if (response.status === 200) {
        setUsers(prevUsers => 
          prevUsers.map(user => 
            selected.has(user.email) 
              ? { ...user, deleted: true }
              : user
          )
        );
        
        setSelected(new Set());
        alert(`${selected.size}명의 사용자가 삭제되었습니다.`);
      } else {
        throw new Error('삭제 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('일괄 삭제 실패:', error);
      alert(error?.response?.data?.message || '일괄 삭제 처리 중 오류가 발생했습니다.');
    }
  };

  // 개별 처리 함수
  const handleApproval = async (email, approve) => {
    if (!email) {
      alert('유효하지 않은 사용자입니다.');
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://ewc-voice-calendar-app.vercel.app';
      await axios.post(`${baseUrl}/api/admin/approve-user`, {
        email,
        approved: approve
      });

      setUsers(prevUsers => {
        if (!Array.isArray(prevUsers)) return prevUsers;
        return prevUsers.map(user => 
          user.email === email 
            ? { ...user, isApproved: approve }
            : user
        );
      });

      alert(`사용자 ${approve ? '승인' : '거부'}가 완료되었습니다.`);
    } catch (error) {
      console.error('사용자 승인/거부 실패:', error);
      alert(error?.message || '처리 중 오류가 발생했습니다.');
    }
  };

  const softDelete = async (email) => {
    if (!email) {
      alert('유효하지 않은 사용자입니다.');
      return;
    }

    if (!window.confirm('정말 이 사용자를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://ewc-voice-calendar-app.vercel.app';
      await axios.delete(`${baseUrl}/api/admin/users/${email}`);
      
      setUsers(prevUsers => {
        if (!Array.isArray(prevUsers)) return prevUsers;
        return prevUsers.map(user => 
          user.email === email 
            ? { ...user, deleted: true }
            : user
        );
      });
      
      alert('사용자가 삭제되었습니다.');
    } catch (error) {
      console.error('사용자 삭제 실패:', error);
      alert(error?.message || '삭제 처리 중 오류가 발생했습니다.');
    }
  };

  const restoreUser = async (email) => {
    if (!email) {
      alert('유효하지 않은 사용자입니다.');
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://ewc-voice-calendar-app.vercel.app';
      await axios.post(`${baseUrl}/api/admin/users/${email}/restore`);
      
      setUsers(prevUsers => {
        if (!Array.isArray(prevUsers)) return prevUsers;
        return prevUsers.map(user => 
          user.email === email 
            ? { ...user, deleted: false }
            : user
        );
      });
      
      alert('사용자가 복구되었습니다.');
    } catch (error) {
      console.error('사용자 복구 실패:', error);
      alert(error?.message || '복구 처리 중 오류가 발생했습니다.');
    }
  };

  // 관리자 권한 체크
  if (!ADMIN_EMAILS.includes(userEmail)) {
    return (
      <div className="admin-error">
        <h2>접근 권한 없음</h2>
        <p>관리자 권한이 필요한 페이지입니다.</p>
      </div>
    );
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="admin-loading">
        <div className="loading"></div>
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="admin-error">
        <h2>오류 발생</h2>
        <p>{error}</p>
        <button onClick={fetchUsers} className="retry-button">
          다시 시도
        </button>
      </div>
    );
  }

  // 데이터 없음 상태
  if (!users || !Array.isArray(users)) {
    return (
      <div className="admin-error">
        <h2>데이터 없음</h2>
        <p>사용자 데이터를 불러올 수 없습니다.</p>
        <button onClick={fetchUsers} className="retry-button">
          다시 시도
        </button>
      </div>
    );
  }

  // 활성 사용자와 삭제된 사용자 필터링
  const activeUsers = users.filter(u => !u.deleted);
  const deletedUsers = users.filter(u => u.deleted);
  const currentUsers = showDeleted ? deletedUsers : activeUsers;
  const allChecked = selected.size === currentUsers.length && currentUsers.length > 0;

  return (
    <div className="min-h-screen px-4 py-6 bg-gray-50">
      <div className="w-full max-w-[420px] md:max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">👤 사용자 관리</h1>

        {/* 탭 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => {
              setShowDeleted(false);
              setSelected(new Set());
            }}
            className={!showDeleted ? 'font-semibold border-b-2 border-blue-600' : 'text-gray-500'}
          >
            활성 사용자 ({activeUsers.length})
          </button>
          <button
            onClick={() => {
              setShowDeleted(true);
              setSelected(new Set());
            }}
            className={showDeleted ? 'font-semibold border-b-2 border-blue-600' : 'text-gray-500'}
          >
            삭제된 사용자 ({deletedUsers.length})
          </button>
        </div>

        {/* 일괄 처리 버튼 */}
        {!showDeleted && selected.size > 0 && (
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleBulkApproval}
              disabled={!selected.size}
              className="px-3 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors"
            >
              선택 승인 ({selected.size})
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={!selected.size}
              className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-40 hover:bg-red-700 transition-colors"
            >
              선택 삭제 ({selected.size})
            </button>
          </div>
        )}

        {/* 테이블 */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 w-[42px]">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => toggleAll(currentUsers)}
                    className="accent-blue-600 w-4 h-4"
                  />
                </th>
                <th className="p-2 w-[42px]">#</th>
                <th className="p-2">이메일</th>
                <th className="p-2">이름</th>
                <th className="p-2">요청일</th>
                <th className="p-2">상태</th>
                <th className="p-2">액션</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((user, idx) => (
                <tr key={user.email} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(user.email)}
                      onChange={() => toggleOne(user.email)}
                      className="accent-blue-600 w-4 h-4"
                    />
                  </td>
                  <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                  <td className="p-2">{user.email}</td>
                  <td className="p-2">{user.name}</td>
                  <td className="p-2 whitespace-nowrap">
                    {new Date(user.requestDate).toLocaleDateString()}
                  </td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.isApproved 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.isApproved ? '승인됨' : '대기중'}
                    </span>
                  </td>
                  <td className="p-2">
                    {!showDeleted ? (
                      <div className="flex gap-2">
                        {!user.isApproved && (
                          <button
                            onClick={() => handleApproval(user.email, true)}
                            className="text-emerald-600 hover:text-emerald-700 hover:underline"
                          >
                            승인
                          </button>
                        )}
                        <button
                          onClick={() => softDelete(user.email)}
                          className="text-red-600 hover:text-red-700 hover:underline"
                        >
                          삭제
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => restoreUser(user.email)}
                        className="text-blue-600 hover:text-blue-700 hover:underline"
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
      </div>
    </div>
  );
};

export default AdminDashboard; 