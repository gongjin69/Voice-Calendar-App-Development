import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // 개발 환경에서는 전역 변수를 사용하여 연결 재사용
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // 프로덕션 환경에서는 새로운 연결 생성
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// 데이터베이스 인스턴스 내보내기
export const db = (await clientPromise).db(process.env.MONGODB_DB || 'voice-calendar');

// 클라이언트 프로미스도 내보내기 (필요한 경우 사용)
export default clientPromise; 