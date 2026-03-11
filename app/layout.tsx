import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AuthProvider from './AuthProvider'; 
import NavigationBar from './NavigationBar'; // 신규 추가: 분리된 메뉴바 컴포넌트 불러오기

const inter = Inter({ subsets: ['latin'] });

// PWA 및 앱 메타데이터 설정 (기존 100% 유지)
export const metadata: Metadata = {
  title: 'J-TECH ERP',
  description: '제이테크 실무용 통합 관리 시스템',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
};

// 메인 레이아웃 (기존 구조 파괴 없이 메뉴바 모듈화 적용)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-gray-50 pb-16 md:pb-0`}>
        {/* 보안 가드: 로그인 안 한 사람은 접근 불가 처리 */}
        <AuthProvider>
          
          {/* 상단/하단 네비게이션 메뉴 (로그인 화면에서는 자동으로 숨겨짐) */}
          <NavigationBar />
          
          {/* 각 페이지의 실제 콘텐츠가 렌더링되는 영역 */}
          <main className="w-full">
            {children}
          </main>
          
        </AuthProvider>
      </body>
    </html>
  );
}