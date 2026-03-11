"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 모바일 및 PC 반응형 네비게이션 메뉴 컴포넌트 (로그인 화면 숨김 기능 완벽 적용)
export default function NavigationBar() {
  const pathname = usePathname();

  // 현재 주소가 로그인 페이지('/login')라면, 네비게이션 바를 아예 화면에 그리지 않고 종료합니다.
  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="bg-blue-700 text-white shadow-md print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            {/* 로고 영역 */}
            <Link href="/invoice" className="flex-shrink-0 font-extrabold text-xl tracking-wider">
              J-TECH
            </Link>
            {/* PC 및 태블릿(폴드 펼친 화면) 메뉴 */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link href="/invoice" className="hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-medium transition">명세서 작성</Link>
                <Link href="/sales" className="hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-medium transition">매출 조회</Link>
                <Link href="/clients" className="hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-medium transition">거래처 관리</Link>
                <Link href="/products" className="hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-medium transition">품목 관리</Link>
              </div>
            </div>
          </div>
          {/* 우측 상단 유저 컨트롤 (로그아웃 기능) */}
          <div className="hidden md:block">
            <Link href="/login" className="bg-blue-800 hover:bg-blue-900 px-3 py-2 rounded-md text-sm font-medium transition">
              로그아웃
            </Link>
          </div>
        </div>
      </div>

      {/* 모바일(스마트폰) 전용 하단 고정 탭 바 (앱 스타일) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex justify-around items-center h-16 text-xs text-gray-600 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <Link href="/invoice" className="flex flex-col items-center justify-center w-full h-full hover:text-blue-600 hover:bg-gray-50">
          <span className="text-xl mb-1">📝</span>
          <span className="font-medium">명세서</span>
        </Link>
        <Link href="/sales" className="flex flex-col items-center justify-center w-full h-full hover:text-blue-600 hover:bg-gray-50 border-l border-gray-100">
          <span className="text-xl mb-1">📊</span>
          <span className="font-medium">매출조회</span>
        </Link>
        <Link href="/clients" className="flex flex-col items-center justify-center w-full h-full hover:text-blue-600 hover:bg-gray-50 border-l border-gray-100">
          <span className="text-xl mb-1">🏢</span>
          <span className="font-medium">거래처</span>
        </Link>
        <Link href="/products" className="flex flex-col items-center justify-center w-full h-full hover:text-blue-600 hover:bg-gray-50 border-l border-gray-100">
          <span className="text-xl mb-1">⚙️</span>
          <span className="font-medium">품목</span>
        </Link>
      </div>
    </nav>
  );
}