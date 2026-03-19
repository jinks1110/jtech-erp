"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  // 핵심 보안: 현재 주소가 '/login'이면 이 상단 메뉴를 아예 렌더링하지 않습니다.
  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="bg-gray-900 text-white shadow-md print:hidden sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex justify-between items-center h-16 overflow-x-auto whitespace-nowrap hide-scrollbar">
          
          <Link href="/" className="flex-shrink-0 flex items-center mr-6">
            <span className="font-extrabold text-xl tracking-wider text-blue-400">J-TECH</span>
            <span className="ml-2 font-medium text-sm text-gray-300 hidden md:inline">ERP</span>
          </Link>

          <div className="flex space-x-1 md:space-x-4">
            <Link href="/invoice" className="px-3 py-2 rounded-md text-sm font-medium text-blue-300 hover:bg-gray-700 transition">명세서 작성</Link>
            <Link href="/sales" className="px-3 py-2 rounded-md text-sm font-medium text-blue-300 hover:bg-gray-700 transition">매출 조회</Link>
            <div className="h-6 w-px bg-gray-600 mx-2 self-center hidden md:block"></div>
            <Link href="/quotation" className="px-3 py-2 rounded-md text-sm font-medium text-yellow-400 hover:bg-gray-700 transition">견적서 작성</Link>
            <Link href="/quotation-list" className="px-3 py-2 rounded-md text-sm font-medium text-yellow-400 hover:bg-gray-700 transition">견적 조회</Link>
            <div className="h-6 w-px bg-gray-600 mx-2 self-center hidden md:block"></div>  
            <Link href="/clients" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition">거래처</Link>
            <Link href="/products" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition">품목/단가</Link>
          </div>

        </div>
      </div>
    </nav>
  );
}