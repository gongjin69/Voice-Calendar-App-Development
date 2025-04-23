import 'regenerator-runtime/runtime';
import React, { useEffect, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import axios from 'axios';
import md5 from 'md5';

// Polyfill for speech recognition
const SpeechRecognitionPolyfill = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognitionPolyfill) {
  console.error('Speech recognition is not supported in this browser');
}

const CLIENT_ID = '1013074395482-u7uq1tavr0fodg0an454k609qmot57ac.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAmt5-72N9yZCMp_zpmGdX8T-I90knNvKw';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

// 관리자 이메일 상수 정의
const ADMIN_EMAIL = 'cspark69@ewckids.com';
// 테스트 사용자 이메일 목록
const TEST_USERS = [
  'cspark69@ewckids.com',
  'mo@ewckids.com',  // 테스트 사용자 추가
  // 여기에 다른 테스트 사용자 이메일을 추가할 수 있습니다
];

// API 기본 URL 설정
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://voice-calendar-app.uc.r.appspot.com'  // Google App Engine URL
  : 'http://localhost:3001';

// 서버 상태 확인을 위한 함수
const checkServerConnection = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/health`);
    setIsServerConnected(response.data.status === 'healthy');
  } catch (error) {
    console.error('Server connection check failed:', error);
    setIsServerConnected(false);
  }
};

function App() {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const [gapiInited, setGapiInited] = useState(false);
  const [gisInited, setGisInited] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [eventId, setEventId] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTestUser, setIsTestUser] = useState(false);

  useEffect(() => {
    const loadGoogleAPI = async () => {
      try {
        // Load the Google API client library
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });

        // Load the Google Identity Services library
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });

        await window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: API_KEY,
              discoveryDocs: [DISCOVERY_DOC],
            });
            setGapiInited(true);
          } catch (error) {
            console.error('GAPI 초기화 오류:', error);
          }
        });

        setGisInited(true);
      } catch (error) {
        console.error('Google API 로드 오류:', error);
      }
    };

    loadGoogleAPI();
  }, []);

  // Check server connection
  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/health`);
        setIsServerConnected(response.data.status === 'ok');
        console.log('서버 연결 상태:', response.data);
      } catch (error) {
        console.error('서버 연결 확인 실패:', error);
        setIsServerConnected(false);
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  // Google 사용자 정보 조회 및 관리자/테스트 사용자 확인 함수
  const checkUserAccess = async (userEmail) => {
    try {
      console.log('Checking access for:', userEmail);
      // 관리자 이메일인 경우
      if (userEmail === ADMIN_EMAIL) {
        console.log('Admin access granted');
        setIsAdmin(true);
        setHasAccess(true);
        return true;
      }

      // 테스트 사용자인 경우
      if (TEST_USERS.includes(userEmail)) {
        console.log('Test user access granted');
        setIsTestUser(true);
        setHasAccess(true);
        return true;
      }

      // 일반 사용자의 경우 서버에 접근 권한 확인
      const accessResponse = await axios.get(`${API_BASE_URL}/api/check-access/${userEmail}`);
      console.log('Server access response:', accessResponse.data);
      setHasAccess(accessResponse.data.hasAccess);
      return accessResponse.data.hasAccess;
    } catch (error) {
      console.error('사용자 접근 권한 확인 실패:', error);
      setHasAccess(false);
      return false;
    }
  };

  // 로그인 핸들러 수정
  const handleLogin = async () => {
    if (!gapiInited || !gisInited) {
      console.error('Google API가 아직 초기화되지 않았습니다.');
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        ux_mode: 'popup',
        callback: async (response) => {
          if (response.error !== undefined) {
            console.error('OAuth 오류:', response);
            return;
          }
          
          try {
            // Get user info
            const userInfoResponse = await window.gapi.client.oauth2.userinfo.get();
            const userEmail = userInfoResponse.result.email;
            setUserEmail(userEmail);
            
            // 사용자 접근 권한 확인
            const hasAccess = await checkUserAccess(userEmail);
            if (hasAccess) {
              setIsSignedIn(true);
              console.log('Login completed for:', userEmail);
            }
          } catch (error) {
            console.error('사용자 정보 조회 실패:', error);
          }
        },
      });

      tokenClient.requestAccessToken({
        prompt: 'consent'
      });
    } catch (error) {
      console.error('로그인 오류:', error);
    }
  };

  const handleLogout = () => {
    try {
      const token = gapi.client.getToken();
      if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        setIsSignedIn(false);
        setEventId(null);
        setEvents([]);
        setIsAdmin(false);
        setIsTestUser(false);
        setHasAccess(false);
        setUserEmail('');
        setUserName('');
      }
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  const fetchRecentEvents = async () => {
    if (!isSignedIn) return;
    
    setIsLoading(true);
    try {
      const now = new Date();
      // 현재 날짜의 시작 시점으로 설정
      now.setHours(0, 0, 0, 0);
      
      // 향후 10일 후의 날짜 설정
      const tenDaysLater = new Date(now);
      tenDaysLater.setDate(now.getDate() + 10);
      tenDaysLater.setHours(23, 59, 59, 999);

      // 먼저 캘린더 목록을 가져옵니다
      const calendarList = await gapi.client.calendar.calendarList.list();
      const calendars = calendarList.result.items || [];
      
      // 모든 캘린더에서 일정을 가져옵니다
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
          
          // 각 일정에 캘린더 정보를 추가합니다
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

      // 날짜순으로 정렬
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

  const handleCreateEvent = async (eventData) => {
    try {
      const response = await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: eventData,
      });

      setEventId(response.result.id);
      await fetchRecentEvents();
      return response.result;
    } catch (error) {
      console.error('일정 생성 오류:', error);
      throw error;
    }
  };

  const createEvent = async () => {
    if (!isSignedIn) return;

    try {
      // 음성 입력에서 날짜와 시간 정보 추출
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

      // 종료 시간은 시작 시간으로부터 1시간 후로 설정
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
        // 기본 알림 설정 추가
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24시간 전 이메일
            { method: 'popup', minutes: 60 }, // 1시간 전 팝업
          ],
        },
      };

      const response = await handleCreateEvent(event);
      setEventId(response.id);
      alert('✅ 일정이 등록되었습니다!\n기본 알림이 설정되었습니다:\n- 24시간 전 이메일\n- 1시간 전 팝업 알림');
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
          description: '수정됨',
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
        <button 
          onClick={() => window.location.reload()} 
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
            }}>VOICE 구글캘린더</h1>
          </div>
        </div>
        {!gapiInited || !gisInited ? (
          <button disabled className="login-button">
            초기화 중...
          </button>
        ) : isSignedIn ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src={`https://www.gravatar.com/avatar/${userEmail ? md5(userEmail) : ''}?d=mp`}
                alt="User Avatar"
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%',
                  border: '2px solid white'
                }}
              />
              <span style={{ color: 'white' }}>{userEmail}</span>
            </div>
            <button 
              onClick={handleLogout} 
              className="login-button"
              style={{ width: 'auto', padding: '8px 16px' }}
            >
              🔓 로그아웃
            </button>
          </div>
        ) : (
          <button onClick={handleLogin} className="login-button">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" 
              alt="Google Logo" 
              style={{ width: '20px', height: '20px' }}
            />
            Google 로그인
          </button>
        )}

        {isSignedIn && !hasAccess && !isAdmin && !isTestUser && (
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '10px' }}>
            <h2>액세스 요청</h2>
            <p>이 애플리케이션을 사용하기 위해서는 관리자의 승인이 필요합니다.</p>
            <button
              onClick={handleLogin}
              disabled={isRequestingAccess}
              style={{
                backgroundColor: '#4285f4',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: isRequestingAccess ? 'not-allowed' : 'pointer',
                opacity: isRequestingAccess ? 0.7 : 1
              }}
            >
              {isRequestingAccess ? '요청 처리 중...' : '액세스 요청하기'}
            </button>
          </div>
        )}

        {isSignedIn && (
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
                🎧 듣는 중: {listening ? '✅' : '❌'}
              </p>
              <div className="voice-buttons">
                <button 
                  onClick={() => SpeechRecognition.startListening({ continuous: true, language: 'ko-KR' })}
                  className="start-button"
                >
                  🎙️ 말하기
                </button>
                <button 
                  onClick={SpeechRecognition.stopListening}
                  className="stop-button"
                >
                  🛑 멈추기
                </button>
                <button 
                  onClick={resetTranscript}
                  className="reset-button"
                >
                  🔄 초기화
                </button>
              </div>

              <div className="transcript-box">
                <h3 style={{ marginBottom: '10px', color: '#333' }}>📝 인식된 텍스트</h3>
                <p style={{ color: '#666' }}>{transcript}</p>
              </div>

              <div className="event-controls">
                <button 
                  onClick={createEvent}
                  style={{ backgroundColor: 'var(--secondary-color)', color: 'white' }}
                >
                  📅 일정 등록
                </button>
                <button 
                  onClick={updateEvent}
                  style={{ backgroundColor: 'var(--warning-color)', color: 'white' }}
                >
                  ✏️ 일정 수정
                </button>
                <button 
                  onClick={deleteEvent}
                  style={{ backgroundColor: 'var(--danger-color)', color: 'white' }}
                >
                  🗑️ 일정 삭제
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
                <h2 style={{ color: '#333' }}>📅 최근 일정</h2>
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
                  {isLoading ? '로딩 중...' : '🔄 새로고침'}
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
                        <span className="calendar-tag">
                          {event.calendarTitle}
                        </span>
                      </div>
                      <p className="event-time">
                        🕒 {new Date(event.start.dateTime || event.start.date).toLocaleString()}
                      </p>
                      <p className="event-time">
                        ⏰ {new Date(event.end.dateTime || event.end.date).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                    {isLoading ? '일정을 불러오는 중...' : '최근 일정이 없습니다.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 