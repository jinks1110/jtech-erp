import './globals.css';
import { Inter } from 'next/font/google';
import Navbar from './components/Navbar';
import AuthGuard from './components/AuthGuard'; // === 신규: 수문장 불러오기 ===

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
      <body className={`${inter.className} bg-gray-50 text-black min-h-screen flex flex-col`}>
        
        {/* === 핵심 보안: 사이트 전체를 AuthGuard로 꽁꽁 싸매버림 === */}
        <AuthGuard>
          {/* 네비게이션 바 컴포넌트 */}
          <Navbar />

          {/* 본문 컨텐츠 영역 */}
          <main className="flex-grow">
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