"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 모바일 및 PC 반응형 네비게이션 메뉴 (로고 홈 링크 수정 완료)
export default function NavigationBar() {
  const pathname = usePathname();

  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="bg-blue-700 text-white shadow-md print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            {/* 로고 영역: 클릭 시 메인 대시보드('/')로 이동하도록 완벽 수정 */}
            <Link href="/" className="flex-shrink-0 font-extrabold text-xl tracking-wider hover:text-blue-200 transition">
              J-TECH
            </Link>
            
            {/* PC 및 태블릿 메뉴 */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link href="/invoice" className="hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-medium transition">명세서 작성</Link>
                <Link href="/sales" className="hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-medium transition">매출 조회</Link>
                <Link href="/clients" className="hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-medium transition">거래처 관리</Link>
                <Link href="/products" className="hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-medium transition">품목 관리</Link>
              </div>
            </div>
          </div>
          {/* 우측 상단 유저 컨트롤 */}
          <div className="hidden md:block">
            <Link href="/login" className="bg-blue-800 hover:bg-blue-900 px-3 py-2 rounded-md text-sm font-medium transition">
              로그아웃
            </Link>
          </div>
        </div>
      </div>

      {/* 모바일 하단 고정 탭 바 */}
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