"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false });

  // 링크를 통해 올바르게 접근했는지 확인 (세션 체크)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ text: '유효하지 않거나 만료된 링크입니다. 로그인 페이지로 이동합니다.', isError: true });
        setTimeout(() => router.push('/login'), 3000);
      }
    };
    checkSession();
  }, [router]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setMessage({ text: '비밀번호는 최소 6자 이상이어야 합니다.', isError: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: '비밀번호가 서로 일치하지 않습니다.', isError: true });
      return;
    }

    try {
      setLoading(true);
      setMessage({ text: '', isError: false });

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({ text: '비밀번호가 성공적으로 변경되었습니다! 로그인 페이지로 이동합니다.', isError: false });
      
      // 변경 성공 시 기존 로그인 세션을 파기하고 로그인 창으로 보냄
      await supabase.auth.signOut();
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (error: any) {
      setMessage({ text: '비밀번호 변경에 실패했습니다. 다시 시도해주세요.', isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 text-black">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">새 비밀번호 설정</h1>
          <p className="text-gray-500 text-sm">새롭게 사용할 비밀번호를 입력해 주세요.</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              placeholder="새로운 비밀번호 입력 (6자 이상)"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              placeholder="비밀번호 다시 입력"
              required
            />
          </div>

          {message.text && (
            <div className={`text-sm text-center p-3 rounded font-bold ${message.isError ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-bold text-lg transition shadow-md ${
              loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? '변경 중...' : '비밀번호 변경하기'}
          </button>
        </form>
      </div>
    </div>
  );
}