"use client";

import React from 'react';
import Link from 'next/link';

// 제이테크 ERP 메인 대시보드 (대문 화면)
export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-black">
      <div className="max-w-4xl w-full bg-white rounded-xl shadow-lg p-8 md:p-12 text-center border-t-8 border-blue-700">
        <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
          J-TECH 통합 관리 시스템
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          모바일과 PC 어디서든 빠르고 정확하게 업무를 처리하세요.
        </p>
        
        {/* 핵심 기능 바로가기 버튼들 (앱 스타일) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <Link href="/invoice" className="bg-blue-50 p-6 md:p-8 rounded-xl border border-blue-100 hover:bg-blue-100 transition flex flex-col items-center justify-center group">
            <span className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">📝</span>
            <span className="text-2xl font-bold text-blue-800 mb-1">명세서 작성</span>
            <span className="text-sm text-gray-500">새로운 거래명세표 발행 및 인쇄</span>
          </Link>
          
          <Link href="/sales" className="bg-green-50 p-6 md:p-8 rounded-xl border border-green-100 hover:bg-green-100 transition flex flex-col items-center justify-center group">
            <span className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">📊</span>
            <span className="text-2xl font-bold text-green-800 mb-1">매출 조회</span>
            <span className="text-sm text-gray-500">월별/거래처별 매출 내역 및 엑셀 다운로드</span>
          </Link>
          
          <Link href="/clients" className="bg-purple-50 p-6 md:p-8 rounded-xl border border-purple-100 hover:bg-purple-100 transition flex flex-col items-center justify-center group">
            <span className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">🏢</span>
            <span className="text-2xl font-bold text-purple-800 mb-1">거래처 관리</span>
            <span className="text-sm text-gray-500">신규 거래처 등록 및 정보 수정</span>
          </Link>
          
          <Link href="/products" className="bg-orange-50 p-6 md:p-8 rounded-xl border border-orange-100 hover:bg-orange-100 transition flex flex-col items-center justify-center group">
            <span className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">⚙️</span>
            <span className="text-2xl font-bold text-orange-800 mb-1">품목 관리</span>
            <span className="text-sm text-gray-500">하네스 등 품목 단가 및 규격 세팅</span>
          </Link>
        </div>
      </div>
    </div>
  );
}