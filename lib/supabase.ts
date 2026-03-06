// 전체 완성형 코드: Supabase 클라이언트 연결 및 우분투/Vercel 빌드 에러 방지 설정
import { createClient } from '@supabase/supabase-js';

// 환경 변수가 없을 경우 빌드 에러 및 서버 크래시 방지를 위한 안전 장치
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('주의: Supabase 환경 변수가 설정되지 않았습니다. 우분투의 .env.local 파일을 확인하세요.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);