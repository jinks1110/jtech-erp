"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 제이테크 ERP 전역 보안 가드 (로그인 안 된 사용자 차단)
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // 현재 브라우저에 제이테크 로그인 세션(열쇠)이 있는지 확인
      const { data: { session } } = await supabase.auth.getSession();

      // 열쇠가 없고, 현재 들어오려는 페이지가 로그인 페이지가 아니라면 -> 로그인 창으로 강제 추방
      if (!session && pathname !== '/login') {
        router.push('/login');
      } else {
        // 열쇠가 확인되면 통과
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  // 보안 검사 중일 때 하얀 화면 표시 (데이터가 노출되는 깜빡임 방지)
  if (isChecking && pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-bold">
        보안 연결 및 로그인 상태 확인 중...
      </div>
    );
  }

  return <>{children}</>;
}