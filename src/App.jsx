import 'regenerator-runtime/runtime';
import React, { useEffect, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import axios from 'axios';
import md5 from 'md5';
import './App.css';
import AdminDashboard from './components/AdminDashboard';

// Google Calendar API 설정
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

// 관리자 이메일 목록
const ADMIN_EMAILS = ['cspark69@ewckids.com', 'mo@ewckids.com'];
const MASTER_ADMIN_EMAIL = 'cspark69@ewckids.com';

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
  const [isGapiInitialized, setIsGapiInitialized] = useState(false);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const [authInstance, setAuthInstance] = useState(null);

  // Google API 초기화
  useEffect(() => {
    console.log("Google API 초기화 시작");
    
    const loadGoogleAPI = () => {
      if (!window.gapi) {
        console.log("Google API가 로드되지 않음, 다시 시도 중");
        setTimeout(loadGoogleAPI, 1000);
        return;
      }

      // API 클라이언트 초기화
      window.gapi.load('client:auth2', async () => {
        try {
          console.log("Google API 클라이언트 초기화 중");
          await window.gapi.client.init({
            apiKey: window.googleConfig?.apiKey || import.meta.env.VITE_GOOGLE_API_KEY,
            clientId: window.googleConfig?.clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID,
            discoveryDocs: window.googleConfig?.discoveryDocs || ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
            scope: window.googleConfig?.scopes || 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
          });

          const auth = window.gapi.auth2.getAuthInstance();
          setAuthInstance(auth);
          setIsGapiInitialized(true);
          setIsAuthInitialized(true);
          console.log("Google API 초기화 완료");

          // 로그인 상태 확인
          if (auth.isSignedIn.get()) {
            console.log("사용자가 이미 로그인됨");
            handleSignInSuccess(auth.currentUser.get());
          }

          // 로그인 상태 변경 리스너
          auth.isSignedIn.listen((isSignedIn) => {
            if (isSignedIn) {
              handleSignInSuccess(auth.currentUser.get());
            } else {
              handleSignOut();
            }
          });
        } catch (error) {
          console.error("Google API 초기화 오류:", error);
          setIsGapiInitialized(false);
          setIsAuthInitialized(false);
          
          // 오류 메시지 표시
          if (document.getElementById('google-auth-error')) {
            document.getElementById('google-auth-error').textContent = 
              "Google API 초기화 오류: " + (error.details || error.message || JSON.stringify(error));
            document.getElementById('google-auth-error').style.display = 'block';
          }
          
          if (window.handleGoogleAuthError) {
            window.handleGoogleAuthError(error);
          }
        }
      });
    };

    loadGoogleAPI();
  }, []);

  // Google 로그인 성공 처리
  const handleSignInSuccess = (googleUser) => {
    try {
      const profile = googleUser.getBasicProfile();
      const email = profile.getEmail();
      console.log('로그인 성공:', email);
      setUserEmail(email);
      setIsSignedIn(true);
      fetchRecentEvents();
    } catch (error) {
      console.error('프로필 정보 가져오기 오류:', error);
      if (window.handleGoogleAuthError) {
        window.handleGoogleAuthError(error);
      }
    }
  };

  // 로그인 처리
  const handleSignIn = () => {
    if (!isGapiInitialized || !isAuthInitialized) {
      console.error("Google API가 초기화되지 않았습니다");
      alert("Google API 초기화 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    try {
      if (authInstance) {
        console.log("로그인 시도 중");
        authInstance.signIn({
          ux_mode: 'popup',
          prompt: 'select_account'
        }).catch(error => {
          console.error('로그인 오류:', error);
          if (window.handleGoogleAuthError) {
            window.handleGoogleAuthError(error);
          }
        });
      } else {
        console.error("인증 인스턴스가 없습니다");
      }
    } catch (error) {
      console.error('로그인 시도 오류:', error);
      if (window.handleGoogleAuthError) {
        window.handleGoogleAuthError(error);
      }
    }
  };

  // 로그아웃 처리
  const handleSignOut = () => {
    try {
      if (authInstance) {
        authInstance.signOut();
      }
      setIsSignedIn(false);
      setUserEmail('');
      setEvents([]);
      setEventId(null);
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  // 로그인 버튼 렌더링
  const renderLoginButton = () => {
    if (!isSignedIn) {
      return (
        <div>
          <button 
            onClick={handleSignIn} 
            className="login-button"
            disabled={!isGapiInitialized || !isAuthInitialized}
          >
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" 
              alt="구글 로고" 
              style={{ width: '20px', height: '20px', marginRight: '10px' }}
            />
            {!isGapiInitialized || !isAuthInitialized ? '초기화 중...' : '구글 로그인'}
          </button>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            {!isGapiInitialized || !isAuthInitialized ? 
              '구글 API를 초기화하는 중입니다. 잠시만 기다려주세요.' : 
              '구글 계정으로 로그인하여 음성 일정 관리 서비스를 이용하세요.'}
          </p>
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

  // Check server connection
  useEffect(() => {
    const checkServer = async () => {
      try {
        // 배포된 URL로 직접 요청
        const response = await axios.get('https://ewc-voice-calendar-app.vercel.app/api/health', {
          timeout: 5000, // 5초 타임아웃 설정
          validateStatus: (status) => status === 200 // 200 상태 코드만 성공으로 처리
        });
        
        console.log('서버 연결 응답:', response.data);
        // 응답이 올바른지 확인
        if (response.data && response.data.status === 'healthy') {
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

  useEffect(() => {
    if (userEmail) {
      checkApprovalStatus();
    }
  }, [userEmail]);

  const fetchRecentEvents = async () => {
    if (!isSignedIn) return;
    
    setIsLoading(true);
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      const tenDaysLater = new Date(now);
      tenDaysLater.setDate(now.getDate() + 10);
      tenDaysLater.setHours(23, 59, 59, 999);

      const calendarList = await gapi.client.calendar.calendarList.list();
      const calendars = calendarList.result.items || [];
      const allEvents = [];
      
      for (const calendar of calendars) {
        try {
          const response = await gapi.client.calendar.events.list({
            calendarId: calendar.id,
            timeMin: now.toISOString(),
            timeMax: tenDaysLater.toISOString(),
            maxResults: 100,
            orderBy: 'startTime',
            singleEvents: true,
          });
          
          const eventsWithCalendar = (response.result.items || []).map(event => ({
            ...event,
            calendarTitle: calendar.summary,
            calendarColor: calendar.backgroundColor
          }));
          
          allEvents.push(...eventsWithCalendar);
        } catch (error) {
          console.error(`${calendar.summary} 캘린더 일정 조회 실패:`, error);
        }
      }

      allEvents.sort((a, b) => {
        const aTime = new Date(a.start.dateTime || a.start.date);
        const bTime = new Date(b.start.dateTime || b.start.date);
        return aTime - bTime;
      });

      setEvents(allEvents);
    } catch (error) {
      console.error('일정 조회 오류:', error);
      alert('일정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const createEvent = async () => {
    if (!isSignedIn) return;

    try {
      const dateTimeRegex = /(\d+)월\s*(\d+)일\s*(오전|오후)?\s*(\d+)시/;
      const match = transcript.match(dateTimeRegex);
      
      let eventDateTime = new Date();
      
      if (match) {
        const [_, month, day, ampm, hour] = match;
        eventDateTime = new Date();
        eventDateTime.setMonth(parseInt(month) - 1);
        eventDateTime.setDate(parseInt(day));
        
        let adjustedHour = parseInt(hour);
        if (ampm === '오후' && adjustedHour !== 12) {
          adjustedHour += 12;
        } else if (ampm === '오전' && adjustedHour === 12) {
          adjustedHour = 0;
        }
        
        eventDateTime.setHours(adjustedHour, 0, 0, 0);
      }

      const endDateTime = new Date(eventDateTime.getTime() + 3600000);

      const event = {
        summary: transcript || '새 일정',
        start: {
          dateTime: eventDateTime.toISOString(),
          timeZone: 'Asia/Seoul',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Asia/Seoul',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 60 },
          ],
        },
      };

      const response = await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      setEventId(response.result.id);
      alert('✅ 일정이 등록되었습니다!\n기본 알림이 설정되었습니다:\n- 24시간 전 이메일\n- 1시간 전 팝업 알림');
      await fetchRecentEvents();
    } catch (error) {
      console.error('일정 등록 오류:', error);
      alert('일정 등록에 실패했습니다.');
    }
  };

  const updateEvent = async () => {
    if (!isSignedIn || !eventId) {
      alert('수정할 일정이 없습니다.');
      return;
    }

    try {
      await gapi.client.calendar.events.patch({
        calendarId: 'primary',
        eventId,
        resource: {
          summary: transcript || '수정된 일정',
        },
      });
      alert('✏️ 일정이 수정되었습니다.');
      await fetchRecentEvents();
    } catch (error) {
      console.error('일정 수정 오류:', error);
      alert('일정 수정에 실패했습니다.');
    }
  };

  const deleteEvent = async () => {
    if (!isSignedIn || !eventId) {
      alert('삭제할 일정이 없습니다.');
      return;
    }

    try {
      await gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });
      setEventId(null);
      alert('🗑️ 일정이 삭제되었습니다.');
      await fetchRecentEvents();
    } catch (error) {
      console.error('일정 삭제 오류:', error);
      alert('일정 삭제에 실패했습니다.');
    }
  };

  const checkApprovalStatus = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/users/approval-status/${userEmail}`);
      setIsApproved(response.data.isApproved);
      setAccessRequestSent(response.data.requestExists);
    } catch (error) {
      console.error('승인 상태 확인 실패:', error);
    }
  };

  const requestAccess = async () => {
    try {
      // 접근 요청 생성
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/access-requests`, {
        email: userEmail,
        name: userEmail.split('@')[0],
      });

      // 마스터 관리자에게 이메일 발송
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/send-email`, {
        to: MASTER_ADMIN_EMAIL,
        subject: '새로운 사용자 접근 요청',
        text: `
          새로운 사용자가 Voice Calendar 접근을 요청했습니다.
          
          이메일: ${userEmail}
          이름: ${userEmail.split('@')[0]}
          요청 시간: ${new Date().toLocaleString()}
          
          관리자 대시보드에서 승인하시거나 이 이메일에 회신하여 승인하실 수 있습니다.
        `
      });

      setAccessRequestSent(true);
      alert('접근 요청이 전송되었습니다. 관리자의 승인을 기다려주세요.');
    } catch (error) {
      console.error('접근 요청 실패:', error);
      alert('접근 요청 중 오류가 발생했습니다. 나중에 다시 시도해주세요.');
    }
  };

  // 관리자 여부 확인
  const isAdmin = userEmail && ADMIN_EMAILS.includes(userEmail);

  // 접근 권한이 없는 경우 표시할 컴포넌트
  const renderAccessDenied = () => (
    <div style={{ 
      padding: '2rem', 
      textAlign: 'center',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <h2 style={{ marginBottom: '1rem', color: '#2C3E50' }}>접근 권한이 필요합니다</h2>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        이 서비스를 이용하기 위해서는 관리자의 승인이 필요합니다.
      </p>
      {!accessRequestSent ? (
        <button 
          onClick={requestAccess}
          style={{
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            padding: '0.8rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          접근 권한 요청하기
        </button>
      ) : (
        <p style={{ color: 'var(--secondary-color)' }}>
          ✓ 접근 요청이 전송되었습니다. 관리자의 승인을 기다려주세요.
        </p>
      )}
    </div>
  );

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
    <div style={{ 
      padding: 0, 
      fontFamily: 'Pretendard', 
      maxWidth: '100%', 
      margin: '0 auto',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, var(--background-color) 0%, var(--light-background) 100%)'
    }}>
      <div style={{
        padding: '20px',
        textAlign: 'center',
        marginBottom: '20px'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <img 
            src="/ewc-kids-logo.svg" 
            alt="EWC KIDS" 
            style={{ 
              height: '40px',
              marginBottom: '30px'
            }} 
          />
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '10px'
          }}>
            <img 
              src="/voice-smile.svg" 
              alt="Voice" 
              style={{ 
                height: '40px'
              }} 
            />
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              margin: 0,
              color: '#333'
            }}>음성 일정 관리</h1>
          </div>
        </div>

        {renderLoginButton()}

        {isSignedIn && (
          <>
            {isAdmin && showAdminDashboard ? (
              <AdminDashboard userEmail={userEmail} />
            ) : (
              isApproved ? (
                <div style={{ padding: '0 20px' }}>
                  <div className="voice-control-section">
                    <h2 style={{ marginBottom: '20px', color: '#333' }}>음성 인식</h2>
                    <p style={{ 
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: listening ? 'var(--secondary-color)' : '#666'
                    }}>
                      🎧 음성 인식 상태: {listening ? '켜짐' : '꺼짐'}
                    </p>
                    <div className="voice-buttons">
                      <button 
                        onClick={() => SpeechRecognition.startListening({ continuous: true, language: 'ko-KR' })}
                        className="start-button"
                      >
                        🎙️ 음성 인식 시작
                      </button>
                      <button 
                        onClick={SpeechRecognition.stopListening}
                        className="stop-button"
                      >
                        🛑 음성 인식 중지
                      </button>
                      <button 
                        onClick={resetTranscript}
                        className="reset-button"
                      >
                        🔄 텍스트 초기화
                      </button>
                    </div>

                    <div className="transcript-box">
                      <h3 style={{ marginBottom: '10px', color: '#333' }}>📝 인식된 내용</h3>
                      <p style={{ color: '#666' }}>{transcript}</p>
                    </div>

                    <div className="event-controls">
                      <button 
                        onClick={createEvent}
                        style={{ backgroundColor: 'var(--secondary-color)', color: 'white' }}
                      >
                        📅 일정 추가하기
                      </button>
                      <button 
                        onClick={updateEvent}
                        style={{ backgroundColor: 'var(--warning-color)', color: 'white' }}
                      >
                        ✏️ 일정 수정하기
                      </button>
                      <button 
                        onClick={deleteEvent}
                        style={{ backgroundColor: 'var(--danger-color)', color: 'white' }}
                      >
                        🗑️ 일정 삭제하기
                      </button>
                    </div>
                  </div>

                  <div className="event-list">
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '20px'
                    }}>
                      <h2 style={{ color: '#333' }}>📅 내 일정 목록</h2>
                      <button 
                        onClick={fetchRecentEvents}
                        className="refresh-button"
                        style={{ 
                          width: 'auto', 
                          padding: '8px 16px',
                          marginTop: 0 
                        }}
                        disabled={isLoading}
                      >
                        {isLoading ? '불러오는 중...' : '🔄 새로고침'}
                      </button>
                    </div>
                    
                    <div className="events-container">
                      {events.length > 0 ? (
                        events.map((event) => (
                          <div 
                            key={event.id} 
                            className={`event-item ${eventId === event.id ? 'selected-event' : ''}`}
                            onClick={() => setEventId(event.id)}
                          >
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'flex-start',
                              gap: '8px'
                            }}>
                              <h3>{event.summary}</h3>
                              <span className="calendar-tag" style={{ backgroundColor: event.calendarColor }}>
                                {event.calendarTitle}
                              </span>
                            </div>
                            <p className="event-time">
                              🕒 시작: {new Date(event.start.dateTime || event.start.date).toLocaleString()}
                            </p>
                            <p className="event-time">
                              ⏰ 종료: {new Date(event.end.dateTime || event.end.date).toLocaleString()}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                          {isLoading ? '일정을 불러오는 중...' : '등록된 일정이 없습니다.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                renderAccessDenied()
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
