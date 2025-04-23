import React from 'react'
import ReactDOM from 'react-dom/client'
import 'regenerator-runtime/runtime'
import App from './App.jsx'
import './index.css'

// 환경 변수 확인 (디버깅용)
console.log('환경 변수 정보:');
console.log('- NODE_ENV:', import.meta.env.MODE);
console.log('- BASE_URL:', import.meta.env.BASE_URL);
console.log('- API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('- 현재 URL:', window.location.href);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
