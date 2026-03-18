"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // 로그인 페이지나 회원가입 페이지면 검사 패스
      if (pathname === '/login' || pathname === '/signup') {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // 현재 세션(로그인 토큰) 확인
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // 토큰이 없으면 즉시 로그인 페이지로 강제 이동 (뒤로가기 방지를 위해 replace 사용)
        router.replace('/login');
      } else {
        // 토큰이 있으면 통과
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };

    checkAuth();

    // 중간에 로그아웃 하거나 세션이 만료될 경우를 실시간 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (pathname !== '/login' && pathname !== '/signup') {
          router.replace('/login');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  // 검사 중일 때는 화면에 아무것도 안 그리거나 로딩 문구만 살짝 띄움
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-bold">인증 정보를 확인 중입니다...</p>
      </div>
    );
  }

  // 로그인이 안 되어있는데 로그인 페이지가 아니라면, 폼 화면 자체를 렌더링 안 함 (완전 차단)
  if (!isAuthenticated && pathname !== '/login' && pathname !== '/signup') {
    return null; 
  }

  // 무사히 통과한 사람만 원래 보려던 화면(children)을 띄워줌
  return <>{children}</>;
}