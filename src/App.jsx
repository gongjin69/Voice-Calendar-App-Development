import 'regenerator-runtime/runtime';
import React, { useEffect, useState, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import axios from 'axios';
import md5 from 'md5';
import './App.css';
import AdminDashboard from './components/AdminDashboard';
import { parseKorDateTime, toRFC3339 } from './utils/korDateParser';

// 관리자 이메일 목록
const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];
const MASTER_ADMIN_EMAIL = 'cspark69@ewckids.com';

// Google API 설정 - 보안 주의사항
// 1. API 키는 반드시 환경 변수로만 사용
// 2. API 키를 코드에 직접 포함하지 않음
// 3. console.log로 API 키 출력 금지
// 4. GitHub에 API 키 포함 금지
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

function App() {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [eventId, setEventId] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isServerConnected, setIsServerConnected] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [accessRequestSent, setAccessRequestSent] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [isTestUser, setIsTestUser] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [gapiInitialized, setGapiInitialized] = useState(false);
  const [gisInitialized, setGisInitialized] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [showEventConfirmModal, setShowEventConfirmModal] = useState(false);
  const [eventToConfirm, setEventToConfirm] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  // 음성 녹음 시작 함수
  const startVoiceRecording = () => {
    setIsRecording(true);
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true, language: 'ko-KR' });
  };

  // 음성 녹음 중지 함수
  const stopVoiceRecording = () => {
    setIsRecording(false);
    SpeechRecognition.stopListening();
  };

  // 구글 API 초기화
  useEffect(() => {
    // API 키가 환경 변수에 설정되어 있는지 확인
    if (!API_KEY || !CLIENT_ID) {
      setApiError('API 키 또는 클라이언트 ID가 설정되지 않았습니다. 관리자에게 문의하세요.');
      return;
    }

    const initializeGoogleAPI = () => {
      // 환경 변수 디버깅 (실제 키 값은 출력하지 않음)
      if (!import.meta.env.VITE_GOOGLE_API_KEY) {
        console.error('환경 변수에 VITE_GOOGLE_API_KEY가 설정되지 않았습니다.');
        setApiError('Google API 키 설정 오류');
        return;
      }
      
      if (!window.gapi) {
        setTimeout(initializeGoogleAPI, 1000);
        return;
      }
      
      // GAPI 초기화 - 오류 처리 강화
      try {
        window.gapi.load('client', () => {
          window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
          }).then(() => {
            setGapiInitialized(true);
            console.log("GAPI 초기화 완료");
          }).catch(error => {
            console.error('GAPI 초기화 오류:', error.message || error);
            setApiError(`Google API 초기화 실패: ${error.message || '알 수 없는 오류'}`);
          });
        });
      } catch (error) {
        console.error('GAPI 로드 오류:', error.message || error);
        setApiError('Google API 로드 실패');
      }
    };
    
    // GSI 초기화 - 오류 처리 강화
    const initializeGSI = () => {
      if (!window.google) {
        setTimeout(initializeGSI, 1000);
        return;
      }
      
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          prompt: 'consent',
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              const tokenData = {
                token: tokenResponse.access_token,
                expires: Date.now() + (tokenResponse.expires_in * 1000)
              };
              
              // 토큰 저장 (API 키는 저장하지 않음)
              localStorage.setItem('google_auth_timestamp', Date.now().toString());
              localStorage.setItem('google_access_token', tokenResponse.access_token);
              
              // 사용자 정보 가져오기
              getUserInfo(tokenResponse.access_token);
            } else {
              console.error('토큰 응답 오류');
              setApiError('인증 토큰을 받아오지 못했습니다.');
            }
          },
          error_callback: (error) => {
            console.error('GSI 오류:', error.type || error);
            setApiError(`인증 오류: ${error.type || '알 수 없는 오류'}`);
          }
        });
        
        setTokenClient(client);
        setGisInitialized(true);
        console.log("GSI 초기화 완료");
      } catch (error) {
        console.error('GSI 초기화 오류:', error.message || error);
        setApiError('Google 인증 초기화 실패');
      }
    };
    
    // 초기화 함수 호출
    initializeGoogleAPI();
    initializeGSI();
    
    // 클린업 함수
    return () => {
      // 필요한 경우 클린업 로직 추가
    };
  }, []);

  // 사용자 정보 가져오기 함수 개선
  const getUserInfo = async (token) => {
    if (!token) {
      console.error('토큰이 없습니다.');
      setApiError('인증 토큰이 없습니다.');
      return;
    }

    try {
      // 직접 fetch를 사용하여 사용자 정보 요청
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Status: ${response.status}`);
      }
      
      const userInfo = await response.json();
      
      if (userInfo && userInfo.email) {
        setUserEmail(userInfo.email);
        setIsSignedIn(true);
        
        // 관리자 여부 확인
        const isUserAdmin = ADMIN_EMAILS.includes(userInfo.email);
        if (isUserAdmin) {
          console.log('관리자 계정으로 로그인됨:', userInfo.email);
          setIsApproved(true); // 관리자는 자동으로 승인
        }
        
        fetchRecentEvents();
        console.log("사용자 정보 가져오기 성공");
      } else {
        throw new Error('사용자 이메일을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('사용자 정보 가져오기 오류:', error.message || error);
      setApiError(`사용자 정보 가져오기 실패: ${error.message || '알 수 없는 오류'}`);
      handleSignOut();
    }
  };

  // 로그인 처리 함수 개선
  const handleSignIn = async () => {
    setIsLoading(true);
    setApiError(null); // 이전 오류 초기화
    
    if (!gapiInitialized || !gisInitialized || !tokenClient) {
      setApiError('Google API가 아직 초기화되지 않았습니다. 잠시 후 다시 시도해주세요.');
      setIsLoading(false);
      return;
    }
    
    try {
      tokenClient.requestAccessToken({
        prompt: 'consent',
        login_hint: ''
      });
    } catch (error) {
      console.error('로그인 오류:', error.message || error);
      setApiError(`로그인 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 로그아웃 처리 함수 개선
  const handleSignOut = () => {
    // 인증 관련 데이터 삭제
    localStorage.removeItem('google_auth_timestamp');
    localStorage.removeItem('google_access_token');
    
    // 상태 초기화
    setIsSignedIn(false);
    setUserEmail('');
    setEvents([]);
    setEventId(null);
    
    // Google 로그아웃 (선택 사항)
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(localStorage.getItem('google_access_token'), () => {
          console.log('토큰 취소 성공');
        });
      } catch (error) {
        console.error('토큰 취소 오류:', error);
      }
    }
  };

  // 로그인 버튼 렌더링
  const renderLoginButton = () => {
    if (!isSignedIn) {
      return (
        <div className="login-section">
          <h2>음성 일정 관리에 오신 것을 환영합니다</h2>
          <p>구글 계정으로 로그인하여 캘린더를 관리하세요</p>
          
          {!gapiInitialized ? (
            <>
              <div className="loading"></div>
              <p>구글 서비스 초기화 중...</p>
            </>
          ) : (
            <button 
              onClick={handleSignIn} 
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-small"></span>
                  <span>로그인 중...</span>
                </>
              ) : (
                <>
                  <img 
                    src="/google-icon.svg" 
                    alt="구글" 
                    style={{ width: "18px", marginRight: "8px" }} 
                  />
                  구글로 로그인하기
                </>
              )}
            </button>
          )}
          
          {apiError && (
            <div style={{ 
              marginTop: "1rem", 
              color: "var(--error)", 
              backgroundColor: "var(--error-bg)",
              padding: "0.75rem",
              borderRadius: "var(--border-radius)",
              fontSize: "0.9rem"
            }}>
              {apiError}
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src={`https://www.gravatar.com/avatar/${userEmail ? md5(userEmail) : ''}?d=mp`}
            alt="사용자 아바타"
            style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%',
              border: '2px solid white'
            }}
          />
          <span style={{ color: '#333' }}>{userEmail}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isAdmin && (
            <button 
              onClick={() => setShowAdminDashboard(!showAdminDashboard)}
              className="admin-button"
              style={{ 
                backgroundColor: showAdminDashboard ? 'var(--warning-color)' : 'var(--secondary-color)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {showAdminDashboard ? '일반 모드로 전환' : '관리자 모드로 전환'}
            </button>
          )}
          <button 
            onClick={handleSignOut} 
            className="login-button"
            style={{ width: 'auto', padding: '8px 16px' }}
          >
            🔓 로그아웃
          </button>
        </div>
      </div>
    );
  };

  // 서버 연결 확인
  useEffect(() => {
    const checkServer = async () => {
      try {
        // 상대 경로로 요청
        const response = await axios.get('/api/health', {
          timeout: 5000, // 5초 타임아웃 설정
          validateStatus: (status) => status === 200 // 200 상태 코드만 성공으로 처리
        });
        
        console.log('서버 연결 응답:', response.data);
        // 응답이 올바른지 확인
        if (response.data && (response.data.ok === true || response.data.status === 'ok')) {
          setIsServerConnected(true);
        } else {
          setIsServerConnected(false);
        }
      } catch (error) {
        console.error('서버 연결 확인 실패:', error);
        setIsServerConnected(false);
      }
    };

    checkServer();
    // 30초마다 서버 연결 확인 (더 긴 간격으로 변경)
    const interval = setInterval(checkServer, 30000);
    return () => clearInterval(interval);
  }, []);

  // 승인 상태 확인
  useEffect(() => {
    if (userEmail) {
      checkApprovalStatus();
    }
  }, [userEmail]);

  // 일정 조회 함수 개선
  const fetchRecentEvents = async () => {
    if (!isSignedIn || !gapiInitialized) return;
    
    setIsLoading(true);
    try {
      // 현재 시간
      const now = new Date();
      now.setHours(0, 0, 0, 0); // 오늘 자정 기준
      
      // 일정 조회 종료 시간을 30일 후로 설정
      const oneMonthLater = new Date(now);
      oneMonthLater.setMonth(now.getMonth() + 1);
      oneMonthLater.setHours(23, 59, 59, 999);

      // 구글 API 클라이언트 상태 확인
      if (!window.gapi || !window.gapi.client || !window.gapi.client.calendar) {
        console.error('구글 API 클라이언트가 초기화되지 않았습니다.');
        setApiError('구글 API가 초기화되지 않았습니다. 페이지를 새로고침해 주세요.');
        return;
      }

      console.log('캘린더 목록 조회 시작');
      const calendarList = await window.gapi.client.calendar.calendarList.list();
      console.log('캘린더 목록 조회 결과:', calendarList.result);
      
      const calendars = calendarList.result.items || [];
      const allEvents = [];
      
      // 각 캘린더별로 일정 조회 - 현재부터 미래 1달만 조회
      for (const calendar of calendars) {
        try {
          console.log(`'${calendar.summary}' 캘린더 일정 조회 시작`);
          
          const response = await window.gapi.client.calendar.events.list({
            calendarId: calendar.id,
            timeMin: now.toISOString(),      // 현재 시간부터
            timeMax: oneMonthLater.toISOString(), // 1달 후까지
            maxResults: 250,
            orderBy: 'startTime',
            singleEvents: true,
            showDeleted: false
          });
          
          console.log(`'${calendar.summary}' 캘린더 일정 조회 결과:`, response.result);
          
          // 응답에서 일정 목록 추출하고 캘린더 정보 추가
          const eventsWithCalendar = (response.result.items || [])
            .filter(event => {
              const eventStart = new Date(event.start.dateTime || event.start.date);
              return eventStart >= now; // 현재 시간 이후의 일정만 포함
            })
            .map(event => ({
              ...event,
              calendarTitle: calendar.summary,
              calendarColor: calendar.backgroundColor || '#4285f4'
            }));
          
          allEvents.push(...eventsWithCalendar);
        } catch (error) {
          console.error(`'${calendar.summary}' 캘린더 일정 조회 실패:`, error.message || error);
        }
      }

      // 시작 시간 기준으로 정렬
      allEvents.sort((a, b) => {
        const aTime = new Date(a.start.dateTime || a.start.date);
        const bTime = new Date(b.start.dateTime || b.start.date);
        return aTime - bTime;
      });

      console.log('전체 일정 조회 완료, 건수:', allEvents.length);
      setEvents(allEvents);
      
    } catch (error) {
      console.error('일정 조회 오류:', error.message || error);
      setApiError('일정을 불러오는 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    } finally {
      setIsLoading(false);
    }
  };

  // 일정 생성 함수 개선
  const createEvent = async () => {
    if (!isSignedIn) return;

    try {
      setIsLoading(true);
      
      // 음성 인식 텍스트에서 날짜/시간 정보 파싱
      const parsedDateTime = parseKorDateTime(transcript);
      
      if (!parsedDateTime) {
        throw new Error('날짜와 시간 정보를 인식하지 못했습니다. "4월 28일 저녁 9시" 와 같은 형식으로 말씀해 주세요.');
      }

      console.log('파싱된 일정 정보:', {
        title: parsedDateTime.title,
        start: parsedDateTime.start.toLocaleString(),
        end: parsedDateTime.end.toLocaleString()
      });

      const newEvent = {
        summary: parsedDateTime.title || '새 일정',
        description: '', // 설명 필드 추가
        start: {
          dateTime: toRFC3339(parsedDateTime.start),
          timeZone: 'Asia/Seoul',
        },
        end: {
          dateTime: toRFC3339(parsedDateTime.end),
          timeZone: 'Asia/Seoul',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
          ],
        },
      };

      // 필수 필드 검증
      if (!newEvent.summary || !newEvent.start.dateTime || !newEvent.end.dateTime) {
        throw new Error('필수 필드(제목, 시작 시간, 종료 시간)가 누락되었습니다.');
      }

      console.log('생성할 일정 정보:', newEvent);
      
      // 확인 모달에 표시할 정보 설정
      setEventToConfirm({
        ...newEvent,
        id: 'temp_' + Date.now(),
        dateTimeSet: true
      });
      setShowEventConfirmModal(true);
      
    } catch (error) {
      console.error('일정 생성 준비 오류:', error);
      alert(`일정 등록 준비에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 일정 확인 모달에서 확인 버튼 클릭 시 호출되는 함수
  const confirmAndCreateEvent = async () => {
    if (!isSignedIn || !eventToConfirm) return;
    
    try {
      setIsLoading(true);
      
      // 구글 API 클라이언트 상태 확인
      if (!window.gapi || !window.gapi.client || !window.gapi.client.calendar) {
        throw new Error('구글 API 클라이언트가 초기화되지 않았습니다.');
      }

      // 토큰 재발급이 필요한 경우 처리
      if (!window.gapi.client.getToken()) {
        throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
      }

      // 실제 등록할 이벤트 객체 생성 (dateTimeSet 속성 제거)
      const { dateTimeSet, id, ...eventToCreate } = eventToConfirm;

      let response;
      
      // eventId가 있으면 수정, 없으면 새로 생성
      if (eventId) {
        console.log('일정 수정 요청:', eventId, eventToCreate);
        response = await window.gapi.client.calendar.events.update({
          calendarId: 'primary',
          eventId: eventId,
          resource: eventToCreate,
          sendUpdates: 'all', // 참석자에게 알림 전송
        });
      } else {
        console.log('일정 생성 요청:', eventToCreate);
        response = await window.gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: eventToCreate,
        });
      }

      if (response && response.result && response.result.id) {
        console.log('일정 처리 성공:', response.result);
        setEventId(response.result.id);
        
        // 모달 닫기
        setShowEventConfirmModal(false);
        setEventToConfirm(null);
        
        // 날짜와 시간 정보를 포함한 알림 메시지
        const eventDate = new Date(response.result.start.dateTime);
        const formattedDate = `${eventDate.getFullYear()}년 ${eventDate.getMonth() + 1}월 ${eventDate.getDate()}일 ${eventDate.getHours()}시`;
        
        // 수정 또는 생성 메시지
        const actionMsg = eventId ? '수정' : '등록';
        alert(`✅ 일정이 ${actionMsg}되었습니다! (${formattedDate})\n기본 알림이 설정되었습니다:\n- 24시간 전 이메일\n- 30분 전 팝업 알림`);
        
        // 이벤트 목록 업데이트
        if (eventId) {
          setEvents(prevEvents => 
            prevEvents.map(ev => 
              ev.id === eventId 
                ? { ...response.result, calendarTitle: ev.calendarTitle, calendarColor: ev.calendarColor }
                : ev
            )
          );
        } else {
          setEvents(prevEvents => [{
            ...response.result,
            calendarTitle: '내 캘린더',
            calendarColor: '#4285f4'
          }, ...prevEvents]);
        }
        
        // 선택 초기화
        setSelectedEvents([]);
        setEventId(null);
        
        // 전체 일정 목록 새로고침
        await fetchRecentEvents();
      } else {
        throw new Error('일정 처리 응답에 ID가 없습니다.');
      }
    } catch (error) {
      console.error('일정 처리 오류:', error);
      
      // 상세 오류 정보 로깅
      if (error.result && error.result.error) {
        console.error('API 오류 상세:', error.result.error);
      }
      
      let errorMessage = `일정 ${eventId ? '수정' : '등록'}에 실패했습니다: `;
      if (error.result && error.result.error && error.result.error.message) {
        errorMessage += error.result.error.message;
      } else {
        errorMessage += error.message || '알 수 없는 오류';
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 일정 확인 모달에서 수정 버튼 클릭 시 호출되는 함수
  const editFromConfirmModal = () => {
    const eventToEdit = eventToConfirm;
    setShowEventConfirmModal(false);
    setEventToConfirm(null);
    
    // 음성 인식 시작
    startVoiceRecording();
    
    // 이벤트 ID 설정 (수정을 위해)
    setEventId(eventToEdit.id);
    
    // 사용자에게 안내
    alert('음성 인식이 시작되었습니다. 수정할 일정 내용을 말씀해주세요.');
  };

  // 선택된 일정 수정 함수
  const editSelectedEvent = async () => {
    // 선택된 일정이 없는 경우
    if (selectedEvents.length === 0) {
      alert('수정할 일정을 선택해주세요.');
      return;
    }
    
    // 여러 일정이 선택된 경우
    if (selectedEvents.length > 1) {
      alert('한 번에 하나의 일정만 수정할 수 있습니다.');
      return;
    }
    
    // 선택된 일정 ID로 이벤트 찾기
    const eventId = selectedEvents[0];
    const eventToEdit = events.find(e => e.id === eventId);
    
    if (!eventToEdit) {
      alert('선택한 일정을 찾을 수 없습니다.');
      return;
    }
    
    // 현재 선택된 일정 정보를 transcript에 설정
    resetTranscript();
    const eventDate = new Date(eventToEdit.start.dateTime || eventToEdit.start.date);
    
    // 음성 인식을 위한 안내
    alert(`"${eventToEdit.summary}" 일정을 수정합니다. 새로운 일정 내용을 말씀해주세요.`);
    
    // 음성 인식 시작
    startVoiceRecording();
    
    // 이벤트 ID 설정
    setEventId(eventId);
  };

  // 선택된 일정 삭제 함수
  const deleteSelectedEvents = async (eventIds) => {
    if (!eventIds || eventIds.length === 0) {
      alert('삭제할 일정을 선택해주세요.');
      return;
    }
    
    const confirmDelete = window.confirm(`선택한 ${eventIds.length}개의 일정을 삭제하시겠습니까?`);
    if (!confirmDelete) return;
    
    setIsLoading(true);
    
    try {
      for (const eventId of eventIds) {
        await window.gapi.client.calendar.events.delete({
          calendarId: 'primary',
          eventId,
        });
      }
      
      // 일정 목록 새로고침
      await fetchRecentEvents();
      
      // 선택 초기화
      setSelectedEvents([]);
      setShowEventConfirmModal(false);
      setEventToConfirm(null);
      
      alert('선택한 일정이 삭제되었습니다.');
    } catch (error) {
      console.error('일정 삭제 오류:', error);
      alert('일정 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 체크박스 상태 변경 핸들러
  const handleEventCheckboxChange = (eventId) => {
    setSelectedEvents(prev => {
      if (prev.includes(eventId)) {
        return prev.filter(id => id !== eventId);
      } else {
        return [...prev, eventId];
      }
    });
  };

  // 접근 권한 요청
  const requestAccess = async () => {
    try {
      // 로딩 표시
      setIsLoading(true);
      
      // 접근 요청 생성
      await axios.post('/api/access-requests', {
        email: userEmail,
        name: userEmail.split('@')[0],
      }, {
        timeout: 10000, // 10초 타임아웃
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

      // 마스터 관리자에게 이메일 발송
      await axios.post('/api/send-email', {
        to: MASTER_ADMIN_EMAIL,
        subject: '새로운 사용자 접근 요청',
        text: `
          새로운 사용자가 Voice Calendar 접근을 요청했습니다.
          
          이메일: ${userEmail}
          이름: ${userEmail.split('@')[0]}
          요청 시간: ${new Date().toLocaleString()}
          
          관리자 대시보드에서 승인하시거나 이 이메일에 회신하여 승인하실 수 있습니다.
        `
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

      setAccessRequestSent(true);
      alert('접근 요청이 전송되었습니다. 관리자의 승인을 기다려주세요.');
    } catch (error) {
      console.error('접근 요청 실패:', error.message || error);
      // 개발 환경에서는 자동 승인 처리
      if (process.env.NODE_ENV === 'development' || !import.meta.env.PROD) {
        console.log('개발 환경에서 자동 승인 처리');
        setIsApproved(true);
        setAccessRequestSent(true);
        alert('개발 환경: 자동으로 접근 권한이 승인되었습니다.');
      } else {
        alert('접근 요청 중 오류가 발생했습니다. 나중에 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 접근 권한이 없는 경우 표시할 컴포넌트 (UI 개선)
  const renderAccessDenied = () => (
    <div style={{ 
      padding: '2rem', 
      textAlign: 'center',
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: 'white',
      borderRadius: '10px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      marginTop: '20px'
    }}>
      <img 
        src={`https://www.gravatar.com/avatar/${userEmail ? md5(userEmail) : ''}?d=mp`}
        alt="사용자 아바타"
        style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '50%',
          border: '3px solid #4285f4',
          marginBottom: '20px'
        }}
      />
      
      <h2 style={{ marginBottom: '1rem', color: '#2C3E50' }}>접근 권한이 필요합니다</h2>
      
      <p style={{ marginBottom: '1.5rem', color: '#666' }}>
        <strong>{userEmail}</strong>님, 음성 일정 관리 서비스를 이용하기 위해서는 관리자의 승인이 필요합니다.
      </p>
      
      {isLoading ? (
        <div style={{ marginBottom: '20px' }}>
          <p>요청 처리 중...</p>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid #f3f3f3', 
            borderTop: '4px solid #3498db', 
            borderRadius: '50%',
            margin: '0 auto',
            animation: 'spin 2s linear infinite'
          }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : !accessRequestSent ? (
        <button 
          onClick={requestAccess}
          style={{
            backgroundColor: '#4285f4',
            color: 'white',
            padding: '0.8rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3367d6'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4285f4'}
        >
          접근 권한 요청하기
        </button>
      ) : (
        <div style={{ 
          backgroundColor: '#e8f5e9', 
          padding: '15px',
          borderRadius: '8px',
          color: '#2e7d32',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '24px' }}>✓</span>
          <span>접근 요청이 전송되었습니다. 관리자의 승인을 기다려주세요.</span>
        </div>
      )}
      
      <p style={{ marginTop: '20px', fontSize: '14px', color: '#888' }}>
        관리자 이메일: {MASTER_ADMIN_EMAIL}
      </p>
      
      {/* 디버깅 정보 추가 */}
      <div style={{ 
        marginTop: '20px', 
        padding: '10px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '5px',
        textAlign: 'left',
        fontSize: '12px',
        color: '#666'
      }}>
        <details>
          <summary>문제 해결 정보</summary>
          <p>현재 로그인 이메일: <strong>{userEmail}</strong></p>
          <p>관리자 이메일 목록: <strong>{ADMIN_EMAILS.join(', ')}</strong></p>
          <p>관리자 여부: <strong>{ADMIN_EMAILS.includes(userEmail) ? '예' : '아니오'}</strong></p>
          <p>승인 상태: <strong>{isApproved ? '승인됨' : '승인되지 않음'}</strong></p>
          <p>접근 요청 전송 여부: <strong>{accessRequestSent ? '전송됨' : '전송되지 않음'}</strong></p>
        </details>
      </div>
    </div>
  );

  // 일정 확인 모달 렌더링
  const renderEventConfirmModal = () => {
    if (!showEventConfirmModal || !eventToConfirm) return null;
    
    const startDate = new Date(eventToConfirm.start.dateTime);
    const endDate = new Date(eventToConfirm.end.dateTime);
    
    return (
      <div className="modal-overlay" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div className="modal-content" style={{
          width: '90%',
          maxWidth: '500px',
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '20px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
        }}>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>일정 확인</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#555' }}>일정 제목</h3>
            <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{eventToConfirm.summary}</p>
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#555' }}>일정 시간</h3>
            <p style={{ fontSize: '16px' }}>
              {startDate.getFullYear()}년 {startDate.getMonth() + 1}월 {startDate.getDate()}일 
              {startDate.getDate() === new Date().getDate() ? ' (오늘)' : ''}
            </p>
            <p style={{ fontSize: '16px' }}>
              {startDate.getHours() < 12 ? '오전' : '오후'} {startDate.getHours() % 12 || 12}시 
              {startDate.getMinutes() > 0 ? startDate.getMinutes() + '분' : ''} ~ 
              {endDate.getHours() < 12 ? '오전' : '오후'} {endDate.getHours() % 12 || 12}시
              {endDate.getMinutes() > 0 ? endDate.getMinutes() + '분' : ''}
            </p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', gap: '10px' }}>
            <button 
              onClick={() => {
                setShowEventConfirmModal(false);
                setEventToConfirm(null);
              }} 
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                flex: 1,
                transition: 'background-color 0.2s'
              }}
            >
              취소
            </button>
            <button 
              onClick={() => {
                deleteSelectedEvents([eventToConfirm.id]);
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                flex: 1,
                transition: 'background-color 0.2s'
              }}
            >
              삭제
            </button>
            <button 
              onClick={editFromConfirmModal}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ffc107',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                flex: 1,
                transition: 'background-color 0.2s'
              }}
            >
              수정
            </button>
            <button 
              onClick={confirmAndCreateEvent}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                flex: 1,
                transition: 'background-color 0.2s'
              }}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 일정 목록 렌더링
  const renderEventList = () => {
    if (!events || events.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <span role="img" aria-label="calendar" style={{ fontSize: '48px' }}>📅</span>
          <p className="mt-4 text-gray-500 text-lg">등록된 일정이 없습니다.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {events.map((event) => {
          const startDate = new Date(event.start.dateTime || event.start.date);
          const endDate = new Date(event.end.dateTime || event.end.date);
          const isToday = startDate.toDateString() === new Date().toDateString();
          
          return (
            <div 
              key={event.id} 
              className={`event-item ${selectedEvents.includes(event.id) ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedEvents.includes(event.id)}
                onChange={() => handleEventCheckboxChange(event.id)}
                className="event-checkbox"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-lg">{event.summary}</h3>
                  {isToday && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">오늘</span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <span role="img" aria-label="calendar">📅</span>
                    {startDate.toLocaleDateString('ko-KR', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric', 
                      weekday: 'short' 
                    })}
                  </div>
                  <div className="flex items-center gap-1">
                    <span role="img" aria-label="time">⏰</span>
                    {startDate.toLocaleTimeString('ko-KR', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })} ~ {endDate.toLocaleTimeString('ko-KR', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </div>
                </div>
                {event.calendarTitle && (
                  <div className="mt-2">
                    <span 
                      className="inline-block px-2 py-1 text-xs rounded-full"
                      style={{
                        backgroundColor: event.calendarColor + '20',
                        color: event.calendarColor
                      }}
                    >
                      {event.calendarTitle}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 음성 녹음 컨트롤 렌더링
  const renderVoiceControls = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
            listening ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {listening ? '녹음 중' : '대기 중'}
          </span>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={startVoiceRecording}
            disabled={listening}
            className={`btn ${listening ? 'btn-secondary' : 'btn-success'}`}
          >
            <span role="img" aria-label="microphone">🎤</span>
            녹음 시작
          </button>
          <button 
            onClick={stopVoiceRecording}
            disabled={!listening}
            className={`btn ${!listening ? 'btn-secondary' : 'btn-danger'}`}
          >
            <span role="img" aria-label="stop">⏹️</span>
            녹음 중지
          </button>
          <button 
            onClick={resetTranscript}
            className="btn btn-primary"
          >
            <span role="img" aria-label="reset">🔄</span>
            초기화
          </button>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium mb-2">인식된 내용</h3>
          <p className="min-h-[50px] whitespace-pre-wrap text-gray-600">
            {transcript || '음성을 인식하지 못했습니다. 다시 시도해주세요.'}
          </p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={createEvent}
            className="btn btn-primary flex-1"
          >
            <span role="img" aria-label="calendar">📅</span>
            일정 추가하기
          </button>
          {selectedEvents.length > 0 && (
            <>
              <button 
                onClick={() => editSelectedEvent()}
                className="btn btn-warning flex-1"
              >
                <span role="img" aria-label="edit">✏️</span>
                일정 수정하기
              </button>
              <button 
                onClick={() => deleteSelectedEvents(selectedEvents)}
                className="btn btn-danger flex-1"
              >
                <span role="img" aria-label="delete">🗑️</span>
                일정 삭제하기
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // 관리자 여부 확인
  const isAdmin = userEmail && ADMIN_EMAILS.includes(userEmail);

  if (!browserSupportsSpeechRecognition) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        ⚠️ 이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 사용해주세요.
      </div>
    );
  }

  if (!isServerConnected) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2>서버에 연결할 수 없습니다</h2>
        <p>서버가 실행 중인지 확인해주세요.</p>
        <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
          서버 연결 URL: https://ewc-voice-calendar-app.vercel.app/api/health
        </p>
        <button 
          onClick={() => {
            // 캐시를 무시하고 페이지 새로고침
            window.location.reload(true);
          }} 
          style={{
            padding: '10px 20px',
            marginTop: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          새로고침
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <img 
          src="/ewc-voice-logo.png" 
          alt="EWC VOICE Calendar" 
          className="app-logo"
        />
        {renderLoginButton()}
      </header>

      {isSignedIn && (
        <div className="content-wrapper">
          {isAdmin && showAdminDashboard ? (
            <AdminDashboard userEmail={userEmail} />
          ) : (
            isApproved ? (
              <div className="dashboard-grid">
                {/* 음성 녹음 섹션 */}
                <section className="voice-control-card">
                  <h2 className="text-xl font-semibold mb-4">음성 인식</h2>
                  {renderVoiceControls()}
                </section>

                {/* 일정 목록 섹션 */}
                <section className="event-list-card">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">내 일정 목록</h2>
                    <button 
                      onClick={fetchRecentEvents}
                      className="btn btn-primary"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="loading"></span>
                      ) : (
                        <>
                          <span role="img" aria-label="refresh">🔄</span>
                          새로고침
                        </>
                      )}
                    </button>
                  </div>
                  <div className="event-list">
                    {renderEventList()}
                  </div>
                </section>
              </div>
            ) : (
              renderAccessDenied()
            )
          )}
        </div>
      )}

      {renderEventConfirmModal()}
    </div>
  );
}

export default App;

