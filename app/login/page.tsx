"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase'; 

// 제이테크 ERP 로그인 페이지 (모바일 반응형 및 자동 로그아웃 파기 기능 유지 + 아이디저장/자동로그인/비밀번호찾기 추가)
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  // === 신규 추가: 편의 기능 상태 관리 ===
  const [rememberId, setRememberId] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // 기존 로직 유지 및 자동 로그인 분기 처리
  useEffect(() => {
    const initSession = async () => {
      // 1. 저장된 아이디 불러오기
      const savedEmail = localStorage.getItem('jtech_saved_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberId(true);
      }
      
      // 2. 자동 로그인 설정 확인
      const isAutoLogin = localStorage.getItem('jtech_auto_login') === 'true';
      setAutoLogin(isAutoLogin);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        if (isAutoLogin) {
          // 자동 로그인이 켜져 있으면 파기하지 않고 바로 대문으로 이동
          router.push('/');
        } else {
          // 기존 로직 100% 유지: 자동 로그인이 아니면 무조건 기존 세션(열쇠)을 파기함 (확실한 로그아웃)
          await supabase.auth.signOut();
        }
      }
    };
    initSession();
  }, [router]);

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
        // === 신규: 로그인 성공 시 체크박스 상태에 따라 로컬 스토리지 저장 ===
        if (rememberId) localStorage.setItem('jtech_saved_email', email);
        else localStorage.removeItem('jtech_saved_email');

        if (autoLogin) localStorage.setItem('jtech_auto_login', 'true');
        else localStorage.setItem('jtech_auto_login', 'false');

        // 로그인 성공 시 대문 화면으로 이동
        router.push('/');
      }
    } catch (error: any) {
      console.error('로그인 에러:', error.message);
      setErrorMessage('로그인에 실패했습니다. 이메일이나 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // === 신규: 비밀번호 재설정 이메일 발송 ===
  const handleResetPassword = async () => {
    if (!resetEmail) {
      setResetMessage('가입하신 아이디(이메일)를 입력해주세요.');
      return;
    }

    try {
      setIsResetting(true);
      setResetMessage('');
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        // 재설정 메일 클릭 시 이동할 우리가 새로 만들 페이지 경로
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;
      setResetMessage('비밀번호 재설정 링크가 발송되었습니다. 이메일함을 확인해주세요!');
    } catch (error: any) {
      setResetMessage('메일 발송에 실패했습니다. 가입된 이메일이 맞는지 확인해주세요.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 text-black relative">
      
      {/* === 신규: 비밀번호 찾기 모달 팝업 === */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => setShowResetModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm z-10 border-t-4 border-blue-600">
            <h2 className="text-xl font-bold text-gray-900 mb-2">비밀번호 찾기</h2>
            <p className="text-sm text-gray-600 mb-4">가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.</p>
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition mb-2"
              placeholder="example@jtech.com"
            />
            {resetMessage && (
              <p className={`text-sm mb-4 font-bold ${resetMessage.includes('발송되었습니다') ? 'text-green-600' : 'text-red-500'}`}>
                {resetMessage}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowResetModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200">닫기</button>
              <button onClick={handleResetPassword} disabled={isResetting} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:bg-blue-400">
                {isResetting ? '발송 중...' : '링크 받기'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-bold"
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
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-bold"
              placeholder="••••••••"
              required
            />
          </div>

          {/* === 신규: 체크박스 및 비밀번호 찾기 링크 영역 === */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberId}
                  onChange={(e) => setRememberId(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <span className="ml-2 text-sm font-bold text-gray-600">아이디 저장</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <span className="ml-2 text-sm font-bold text-gray-600">자동 로그인</span>
              </label>
            </div>
            
            <button 
              type="button" 
              onClick={() => { setShowResetModal(true); setResetMessage(''); setResetEmail(''); }}
              className="text-sm font-bold text-blue-600 hover:text-blue-800 transition underline underline-offset-2"
            >
              비밀번호 찾기
            </button>
          </div>

          {/* 에러 메시지 출력 영역 */}
          {errorMessage && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded font-bold">
              {errorMessage}
            </div>
          )}

          {/* 중복 제출 방지 (로딩 상태 처리) */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-bold text-lg transition ${
              loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'
            }`}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}