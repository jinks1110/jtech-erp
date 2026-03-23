"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // 로그인 및 비밀번호 재설정 페이지에서는 사이드바를 숨깁니다.
  if (pathname === '/login' || pathname === '/update-password') return null;

  const handleLogout = async () => {
    if (!window.confirm('ERP 시스템에서 로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  // === 수정: 맨 위에 '홈' 버튼 추가 ===
  const menus = [
    { name: '홈 (대시보드)', path: '/', icon: '🏠' },
    { name: '명세서 작성', path: '/invoice', icon: '✍️' },
    { name: '매출 조회', path: '/sales', icon: '📊' },
    { name: '견적서 작성', path: '/quotation', icon: '📝' },
    { name: '견적내역 관리', path: '/quotation-list', icon: '🗂️' },
    { name: '매입 작성 (사진스캔 예정)', path: '/purchase/new', icon: '📸' },
    { name: '매입 조회', path: '/purchase', icon: '📥' },
    { name: '거래처 관리', path: '/clients', icon: '🏢' },
    { name: '품목/단가 관리', path: '/products', icon: '📦' },
  ];

  return (
    <aside className="w-64 bg-[#0f172a] text-white flex flex-col h-screen sticky top-0 shrink-0 shadow-2xl z-50 print:hidden">
      
      {/* 로고 영역 (클릭 시 홈으로 이동 기능 유지) */}
      <Link 
        href="/" 
        className="p-6 border-b border-gray-800 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800 transition"
      >
        <h1 className="text-2xl font-extrabold tracking-widest text-blue-400">
          J-TECH <span className="text-white">ERP</span>
        </h1>
        <p className="text-xs text-gray-400 mt-2 font-medium">통합 관리 시스템</p>
      </Link>
      
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {menus.map((menu) => {
          // === 핵심 로직: 홈('/') 경로일 때는 정확히 일치할 때만 활성화 ===
          // 다른 메뉴들은 해당 경로로 시작하면 활성화 처리
          const isActive = menu.path === '/' 
            ? pathname === '/' 
            : pathname === menu.path || pathname.startsWith(`${menu.path}/`);
          
          return (
            <Link 
              key={menu.path} 
              href={menu.path} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-lg">{menu.icon}</span>
              {menu.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button 
          onClick={handleLogout} 
          className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 hover:text-red-400 text-gray-300 px-4 py-3 rounded-xl font-bold transition"
        >
          <span>🔒</span> 로그아웃
        </button>
      </div>
    </aside>
  );
}