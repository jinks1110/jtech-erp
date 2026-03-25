"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (pathname === '/login' || pathname === '/update-password') return null;

  const handleLogout = async () => {
    if (!window.confirm('ERP 시스템에서 로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

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
    { name: '공용 자료실', path: '/shared-files', icon: '📂' },
  ];

  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-[60] p-2 bg-[#0f172a] text-white rounded-lg shadow-md print:hidden focus:outline-none"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>

      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-[70]"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-64 bg-[#0f172a] text-white flex flex-col shrink-0 shadow-2xl z-[80] print:hidden transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        
        <button 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="lg:hidden absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>

        <Link 
          href="/" 
          className="p-6 border-b border-gray-800 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800 transition"
        >
          <h1 className="text-2xl font-extrabold tracking-widest text-blue-400">
            J-TECH <span className="text-white">ERP</span>
          </h1>
          <p className="text-xs text-gray-400 mt-2 font-medium">통합 관리 시스템</p>
        </Link>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
          {menus.map((menu) => {
            // === 핵심 수정: 매입 메뉴 주소 충돌 완벽 방어 ===
            const isActive = menu.path === '/' 
              ? pathname === '/' 
              : menu.path === '/purchase'
                ? (pathname === '/purchase' || (pathname.startsWith('/purchase/') && pathname !== '/purchase/new'))
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

        <div className="p-4 border-t border-gray-800 shrink-0">
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 hover:text-red-400 text-gray-300 px-4 py-3 rounded-xl font-bold transition"
          >
            <span>🔒</span> 로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}