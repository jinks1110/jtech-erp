import './globals.css';
import { Inter } from 'next/font/google';
import Sidebar from './components/Sidebar'; // Navbar 대신 Sidebar 로드
import AuthGuard from './components/AuthGuard'; // 수문장 유지

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'J-TECH ERP System',
  description: 'J-TECH Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      {/* flex를 줘서 왼쪽(사이드바)과 오른쪽(메인)으로 나눔 */}
      <body className={`${inter.className} bg-gray-50 text-black flex min-h-screen`}>
        
        {/* 핵심 보안: 사이트 전체를 AuthGuard로 꽁꽁 싸매버림 (유지) */}
        <AuthGuard>
          {/* 좌측 사이드바 컴포넌트 */}
          <Sidebar />

          {/* 본문 컨텐츠 영역 (우측 전체 사용, 스크롤 가능) */}
          <main className="flex-1 flex flex-col h-screen overflow-y-auto relative hide-scrollbar">
            {children}
          </main>
        </AuthGuard>

        <style dangerouslySetInnerHTML={{
          __html: `
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `
        }} />
      </body>
    </html>
  );
}