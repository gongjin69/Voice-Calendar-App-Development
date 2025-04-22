import 'regenerator-runtime/runtime';
import React, { useEffect, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import axios from 'axios';
import { sendKakaoNotification } from './utils/kakaoNotification';

// Polyfill for speech recognition
const SpeechRecognitionPolyfill = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognitionPolyfill) {
  console.error('Speech recognition is not supported in this browser');
}

const CLIENT_ID = '1013074395482-u7uq1tavr0fodg0an454k609qmot57ac.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAmt5-72N9yZCMp_zpmGdX8T-I90knNvKw';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

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
        redirect_uri: window.location.origin,
        callback: async (response) => {
          if (response.error !== undefined) {
            console.error('OAuth 오류:', response);
            return;
          }
          setIsSignedIn(true);
          try {
            // Get user info
            const userInfoResponse = await window.gapi.client.oauth2.userinfo.get();
            const userEmail = userInfoResponse.result.email;
            
            // Check access
            const accessResponse = await axios.get(`http://localhost:3001/api/check-access/${userEmail}`);
            setHasAccess(accessResponse.data.hasAccess);
            
            if (!accessResponse.data.hasAccess) {
              // Request access
              await axios.post('http://localhost:3001/api/request-access', {
                email: userEmail,
                name: userInfoResponse.result.name
              });
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
      }
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  // Check server connection
  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/health');
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

  const fetchRecentEvents = async () => {
    if (!isSignedIn) return;
    
    setIsLoading(true);
    try {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));
      
      const response = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: tenDaysAgo.toISOString(),
        timeMax: now.toISOString(),
        maxResults: 100,
        orderBy: 'startTime',
        singleEvents: true,
      });

      setEvents(response.result.items || []);
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

      if (notificationEnabled && phoneNumber) {
        const eventTime = new Date(eventData.start.dateTime).toLocaleString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        await sendKakaoNotification(
          phoneNumber,
          eventData.summary,
          eventTime
        );
      }

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
        eventDateTime.setMonth(parseInt(month) - 1); // 월은 0부터 시작
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
      };

      const response = await handleCreateEvent(event);
      setEventId(response.id);
      alert('✅ 일정이 등록되었습니다!');
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

  return (
    <div style={{ padding: 30, fontFamily: 'Arial', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>🗣 EWC 음성 구글 캘린더 일정관리</h1>

      {!isServerConnected ? (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#ffebee', 
          borderRadius: '5px', 
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#c62828', marginBottom: '10px' }}>
            서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#2196f3',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            새로고침
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'right', marginBottom: '20px' }}>
          {!gapiInited || !gisInited ? (
            <button disabled style={{ backgroundColor: '#ccc', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'not-allowed' }}>
              초기화 중...
            </button>
          ) : isSignedIn ? (
            <button onClick={handleLogout} style={{ backgroundColor: '#f44336', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              🔓 로그아웃
            </button>
          ) : (
            <button onClick={handleLogin} style={{ backgroundColor: '#4285f4', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              🔐 Google 로그인
            </button>
          )}
        </div>
      )}

      {isSignedIn && !hasAccess && (
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
        <>
          <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
            <h2>🎤 음성 인식</h2>
            <p>
              <strong>🎧 듣는 중:</strong> {listening ? '✅ 예' : '❌ 아니요'}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <button 
                onClick={() => SpeechRecognition.startListening({ continuous: true, language: 'ko-KR' })}
                style={{ backgroundColor: '#4caf50', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', flex: 1 }}
              >
                🎙 말하기 시작
              </button>
              <button 
                onClick={SpeechRecognition.stopListening}
                style={{ backgroundColor: '#ff5722', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', flex: 1 }}
              >
                🛑 멈추기
              </button>
              <button 
                onClick={resetTranscript}
                style={{ backgroundColor: '#2196f3', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', flex: 1 }}
              >
                🔄 초기화
              </button>
            </div>

            <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '5px', marginTop: '10px' }}>
              <h3>📝 인식된 텍스트</h3>
              <p style={{ minHeight: '50px' }}>{transcript}</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={createEvent}
                style={{ backgroundColor: '#4caf50', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', flex: 1 }}
              >
                📅 일정 등록
              </button>
              <button 
                onClick={updateEvent}
                style={{ backgroundColor: '#ffc107', color: 'black', padding: '10px', border: 'none', borderRadius: '5px', flex: 1 }}
              >
                ✏️ 일정 수정
              </button>
              <button 
                onClick={deleteEvent}
                style={{ backgroundColor: '#f44336', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', flex: 1 }}
              >
                🗑️ 일정 삭제
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '10px' }}>
            <h2>📅 최근 10일간의 일정</h2>
            <button 
              onClick={fetchRecentEvents}
              style={{ backgroundColor: '#2196f3', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', marginBottom: '15px' }}
              disabled={isLoading}
            >
              {isLoading ? '로딩 중...' : '🔄 일정 새로고침'}
            </button>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {events.length > 0 ? (
                events.map((event) => (
                  <div 
                    key={event.id} 
                    style={{ 
                      backgroundColor: 'white',
                      padding: '15px',
                      marginBottom: '10px',
                      borderRadius: '5px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setEventId(event.id)}
                  >
                    <h3 style={{ margin: '0 0 10px 0' }}>{event.summary}</h3>
                    <p style={{ margin: '5px 0', color: '#666' }}>
                      🕒 시작: {new Date(event.start.dateTime || event.start.date).toLocaleString()}
                    </p>
                    <p style={{ margin: '5px 0', color: '#666' }}>
                      ⏰ 종료: {new Date(event.end.dateTime || event.end.date).toLocaleString()}
                    </p>
                    {eventId === event.id && (
                      <div style={{ marginTop: '5px', padding: '5px', backgroundColor: '#e3f2fd', borderRadius: '3px' }}>
                        ✅ 선택됨
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: '#666' }}>
                  {isLoading ? '일정을 불러오는 중...' : '최근 일정이 없습니다.'}
                </p>
              )}
            </div>
          </div>

          <div className="notification-settings">
            <h3>알림 설정</h3>
            <div className="notification-controls">
              <label>
                <input
                  type="checkbox"
                  checked={notificationEnabled}
                  onChange={(e) => setNotificationEnabled(e.target.checked)}
                />
                카카오톡 알림 활성화
              </label>
              {notificationEnabled && (
                <>
                  <input
                    type="tel"
                    className="phone-input"
                    placeholder="전화번호를 입력하세요 (예: 010-1234-5678)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    pattern="[0-9]{3}-[0-9]{4}-[0-9]{4}"
                  />
                  <small style={{ color: '#666', marginTop: '0.25rem' }}>
                    형식: 010-1234-5678
                  </small>
                </>
              )}
            </div>
            {notificationMessage && (
              <div className="notification-message">
                {notificationMessage}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App; 