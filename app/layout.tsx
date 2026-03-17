import './globals.css';
import { Inter } from 'next/font/google';
import Link from 'next/link';

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
        
        {/* 상단 글로벌 네비게이션 바 (프린트 시 숨김) */}
        <nav className="bg-gray-900 text-white shadow-md print:hidden sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex justify-between items-center h-16 overflow-x-auto whitespace-nowrap hide-scrollbar">
              
              {/* 로고 영역 */}
              <Link href="/" className="flex-shrink-0 flex items-center mr-6">
                <span className="font-extrabold text-xl tracking-wider text-blue-400">J-TECH</span>
                <span className="ml-2 font-medium text-sm text-gray-300 hidden md:inline">ERP</span>
              </Link>

              {/* 메뉴 영역 */}
              <div className="flex space-x-1 md:space-x-4">
                <Link href="/clients" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition">거래처</Link>
                <Link href="/products" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition">품목/단가</Link>
                <div className="h-6 w-px bg-gray-600 mx-2 self-center hidden md:block"></div>
                <Link href="/quotation" className="px-3 py-2 rounded-md text-sm font-medium text-yellow-400 hover:bg-gray-700 transition">견적서 작성</Link>
                <Link href="/quotation-list" className="px-3 py-2 rounded-md text-sm font-medium text-yellow-400 hover:bg-gray-700 transition">견적 조회</Link>
                <div className="h-6 w-px bg-gray-600 mx-2 self-center hidden md:block"></div>
                <Link href="/invoice" className="px-3 py-2 rounded-md text-sm font-medium text-blue-300 hover:bg-gray-700 transition">명세서 작성</Link>
                <Link href="/sales" className="px-3 py-2 rounded-md text-sm font-medium text-blue-300 hover:bg-gray-700 transition">매출 조회</Link>
              </div>

            </div>
          </div>
        </nav>

        {/* 본문 컨텐츠 영역 */}
        <main className="flex-grow">
          {children}
        </main>

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