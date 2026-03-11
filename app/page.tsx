"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// 제이테크 실무용 통합 대시보드 리디자인
export default function HomePage() {
  const [today, setToday] = useState('');

  // 클라이언트 환경에서만 날짜를 불러와 빌드 에러 방지
  useEffect(() => {
    const dateStr = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });
    setToday(dateStr);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* 상단: 환영 메시지 및 요약 헤더 */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-2xl shadow-lg p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight">J-TECH 통합 관리 시스템</h1>
            <p className="text-blue-100 text-lg font-medium">제조업 실무 최적화 Web ERP (v1.0)</p>
          </div>
          <div className="mt-6 md:mt-0 text-left md:text-right bg-white/10 p-4 rounded-xl backdrop-blur-sm w-full md:w-auto">
            <p className="text-sm text-blue-200 mb-1 font-semibold">오늘의 날짜</p>
            <p className="text-xl font-bold">{today || '날짜를 불러오는 중...'}</p>
          </div>
        </div>

        {/* 중단: 퀵 액션 (빠른 실행 메뉴) */}
        <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4 px-2">빠른 업무 실행</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/invoice" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border border-gray-200 hover:border-blue-500 transition-all group flex flex-col items-center justify-center text-center">
            <div className="bg-blue-50 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 group-hover:bg-blue-100 transition-all">📝</div>
            <span className="font-bold text-gray-800 text-lg">명세서 작성</span>
            <span className="text-xs text-gray-500 mt-2">새 거래명세표 발행</span>
          </Link>

          <Link href="/sales" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border border-gray-200 hover:border-green-500 transition-all group flex flex-col items-center justify-center text-center">
            <div className="bg-green-50 text-green-600 w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 group-hover:bg-green-100 transition-all">📊</div>
            <span className="font-bold text-gray-800 text-lg">매출 조회</span>
            <span className="text-xs text-gray-500 mt-2">내역 검색 및 엑셀</span>
          </Link>

          <Link href="/clients" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border border-gray-200 hover:border-purple-500 transition-all group flex flex-col items-center justify-center text-center">
            <div className="bg-purple-50 text-purple-600 w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 group-hover:bg-purple-100 transition-all">🏢</div>
            <span className="font-bold text-gray-800 text-lg">거래처 관리</span>
            <span className="text-xs text-gray-500 mt-2">신규 거래처 정보 갱신</span>
          </Link>

          <Link href="/products" className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border border-gray-200 hover:border-orange-500 transition-all group flex flex-col items-center justify-center text-center">
            <div className="bg-orange-50 text-orange-600 w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 group-hover:bg-orange-100 transition-all">⚙️</div>
            <span className="font-bold text-gray-800 text-lg">품목 관리</span>
            <span className="text-xs text-gray-500 mt-2">단가 및 규격 갱신</span>
          </Link>
        </div>

        {/* 하단: 시스템 안내 및 향후 확장 패널 */}
        <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center mb-4 border-b pb-3">
            <span className="text-xl mr-2">📌</span>
            <h3 className="text-lg font-bold text-gray-800">시스템 안내</h3>
          </div>
          <ul className="text-sm text-gray-600 space-y-3 list-none pl-1">
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">✔</span>
              <span>PC와 모바일(스마트폰) 화면 모두에 최적화되어, 언제 어디서나 업무를 볼 수 있습니다.</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">✔</span>
              <span>명세서 작성 전, <strong>'거래처'</strong>와 <strong>'품목'</strong> 메뉴에서 기초 데이터를 먼저 등록해 주십시오.</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">✔</span>
              <span>모든 데이터는 실시간으로 클라우드 DB에 암호화되어 안전하게 보관됩니다.</span>
            </li>
          </ul>
        </div>
        
      </div>
    </div>
  );
}