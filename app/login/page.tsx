"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
// 경로 에러 발생 시 '../../lib/supabase' 로 변경하십시오. (Next.js 기본 alias 사용)
import { supabase } from '@/lib/supabase'; 

// 제이테크 ERP 로그인 페이지 (모바일 반응형 완벽 지원)
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  // 빌드 에러 및 런타임 에러 방지를 위한 비동기 예외 처리
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!email || !password) {
      setErrorMessage('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // 로그인 성공 시 명세서 메인 화면으로 이동
        router.push('/invoice');
      }
    } catch (error: any) {
      console.error('로그인 에러:', error.message);
      setErrorMessage('로그인에 실패했습니다. 이메일이나 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 text-black">
      {/* 모바일 한 손 입력을 고려한 넉넉한 여백과 카드 UI */}
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">J-TECH ERP</h1>
          <p className="text-gray-500">실무용 통합 관리 시스템</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="admin@jtech.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="••••••••"
              required
            />
          </div>

          {/* 에러 메시지 출력 영역 */}
          {errorMessage && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
              {errorMessage}
            </div>
          )}

          {/* 중복 제출 방지 (로딩 상태 처리) */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-bold text-lg transition ${
              loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}