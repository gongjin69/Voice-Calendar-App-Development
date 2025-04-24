// 한국어 시간 키워드와 기본 시간 매핑
const korTimeKeywords = {
  새벽: 3,
  아침: 9,
  오전: 9,
  점심: 12,
  낮: 13,
  오후: 15,
  저녁: 19,
  밤: 22,
};

/**
 * 한국어 날짜/시간 문자열을 파싱하여 시작/종료 시간과 제목을 반환
 * @param {string} raw 음성 인식된 원본 텍스트
 * @returns {{ start: Date, end: Date, title: string } | null}
 */
export function parseKorDateTime(raw) {
  const dateRe = /(\d{1,2})월\s*(\d{1,2})일/;
  const timeRe = /(새벽|아침|오전|점심|낮|오후|저녁|밤)?\s*(\d{1,2})[시반]/;

  const dateMatch = raw.match(dateRe);
  const timeMatch = raw.match(timeRe);

  if (!dateMatch || !timeMatch) return null;

  const [, month, day] = dateMatch.map(Number);
  const [, korWord = '', hourRaw] = timeMatch;
  const hourNum = Number(hourRaw);

  // 시간대 보정
  let hour = hourNum;
  if (korWord in korTimeKeywords) {
    const base = korTimeKeywords[korWord];
    // 낮/오후/저녁/밤은 12시간 형식을 24시간 형식으로 변환
    if (hour < 12 && base >= 12) hour += 12;
  }

  // 현재 년도 기준으로 날짜 설정
  const start = new Date();
  start.setMonth(month - 1);
  start.setDate(day);
  start.setHours(hour, 0, 0, 0);

  // 과거 날짜인 경우 내년으로 설정
  if (start < new Date()) {
    start.setFullYear(start.getFullYear() + 1);
  }

  // 종료 시간은 1시간 후로 설정
  const end = new Date(start.getTime() + 3600000);

  // 제목 추출 (날짜와 시간 부분 제거)
  const title = raw.replace(dateRe, '').replace(timeRe, '').trim();

  return { start, end, title };
}

/**
 * Date 객체를 RFC 3339 형식의 문자열로 변환
 * @param {Date} date 변환할 Date 객체
 * @returns {string} RFC 3339 형식의 문자열
 */
export function toRFC3339(date) {
  const pad = (n) => String(n).padStart(2, '0');
  
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  
  // 한국 시간대(+09:00) 고정
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
} 