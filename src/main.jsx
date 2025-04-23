import React from 'react'
import ReactDOM from 'react-dom/client'
import 'regenerator-runtime/runtime'
import App from './App.jsx'
import './index.css'

// API 키 정보 확인
const API_KEY = 'AIzaSyDP1oS9-qS2Jw4apFWfkcj41Z4E9h2Xhxs'
const CLIENT_ID = '708893814495-t2kp3kijss0o4fk0qpnvfghl6igbr4du.apps.googleusercontent.com'

// 환경 변수 확인 (디버깅용)
console.log('환경 변수 정보:')
console.log('- NODE_ENV:', import.meta.env.MODE)
console.log('- BASE_URL:', import.meta.env.BASE_URL)
console.log('- API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)
console.log('- 현재 URL:', window.location.href)
console.log('- 사용 중인 API 키:', API_KEY)
console.log('- 사용 중인 클라이언트 ID:', CLIENT_ID)

// Google API 초기화 상태 확인을 위한 전역 변수
window.gapiInitStatus = {
  loaded: false,
  error: null
}

// Google API 로드 오류를 전역적으로 잡기 위한 핸들러
window.addEventListener('error', (event) => {
  console.error('전역 에러 발생:', event.error)
  if (event.error && (
    event.error.toString().includes('gapi') || 
    event.error.toString().includes('google')
  )) {
    window.gapiInitStatus.error = event.error
    console.error('Google API 관련 오류:', event.error)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
