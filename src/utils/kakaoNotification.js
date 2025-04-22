import axios from 'axios';

export const sendKakaoNotification = async (phoneNumber, eventSummary, eventTime) => {
  try {
    const response = await axios.post('http://localhost:3001/api/send-notification', {
      phoneNumber,
      message: `[일정 알림] ${eventSummary}\n시간: ${eventTime}`
    });

    if (response.data.success) {
      return {
        success: true,
        message: '알림이 성공적으로 전송되었습니다.'
      };
    } else {
      throw new Error(response.data.message || '알림 전송에 실패했습니다.');
    }
  } catch (error) {
    return {
      success: false,
      message: `알림 전송 실패: ${error.message}`
    };
  }
}; 