"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_path: string;
  created_at: string;
}

// === 신규 추가: 알림창(메모) 인터페이스 ===
interface Memo {
  id: string;
  content: string;
  type: string;
  created_at: string;
}

export default function MainPage() {
  const router = useRouter();
  
  // 기존 상태 유지
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [yearlySales, setYearlySales] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);

  // === 신규 추가: 알림창 상태 관리 ===
  const [memos, setMemos] = useState<Memo[]>([]);
  const [memoContent, setMemoContent] = useState('');
  const [memoType, setMemoType] = useState('공지사항');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile) return;

      // 1. 공용 문서 불러오기 (대표님 기존 로직 완벽 유지)
      const { data: attachData, error: attachError } = await supabase
        .from('attachments')
        .select('*')
        .eq('company_id', profile.company_id)
        .is('invoice_id', null) 
        .order('created_at', { ascending: false });

      if (!attachError && attachData) {
        setAttachments(attachData);
      }

      // 2. 매출 계산 불러오기 (대표님 기존 로직 완벽 유지)
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1; 
      const startDate = `${currentYear}-01-01T00:00:00Z`;
      
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('created_at, supply_amount') 
        .eq('company_id', profile.company_id)
        .gte('created_at', startDate);

      if (!invoiceError && invoiceData) {
        let yearly = 0;
        let monthly = 0;

        invoiceData.forEach(inv => {
          yearly += inv.supply_amount || 0;
          const invMonth = new Date(inv.created_at).getMonth() + 1;
          if (invMonth === currentMonth) {
            monthly += inv.supply_amount || 0;
          }
        });

        setYearlySales(yearly);
        setMonthlySales(monthly);
      }

      // === 3. 신규: 공지 및 메모장 데이터 불러오기 ===
      try {
        const { data: memoData, error: memoError } = await supabase
          .from('dashboard_memos')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false });
        if (memoError) throw memoError;
        setMemos(memoData || []);
      } catch (err) {
        // 테이블 미생성 시 에러 방지용 임시 로컬 스토리지 백업
        const localMemos = localStorage.getItem('jtech_memos');
        if (localMemos) setMemos(JSON.parse(localMemos));
      }

    } catch (error) {
      console.error("데이터 불러오기 에러:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // 공용 문서 업로드 (기존 유지)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setIsUploading(true);

      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session!.user.id).single();

      const fileExt = file.name.split('.').pop();
      const fileName = `global_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('attachments').insert([{
        company_id: profile!.company_id,
        file_name: file.name,
        file_path: filePath,
        file_url: urlData.publicUrl
      }]);

      if (dbError) throw dbError;
      
      fetchDashboardData();
      alert('공용 문서가 성공적으로 등록되었습니다.');

    } catch (error: any) {
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // 공용 문서 삭제 (기존 유지)
  const handleDeleteFile = async (id: string, filePath: string) => {
    if (!window.confirm('이 공용 문서를 삭제하시겠습니까?')) return;
    try {
      await supabase.storage.from('attachments').remove([filePath]);
      const { error } = await supabase.from('attachments').delete().eq('id', id);
      if (error) throw error;
      fetchDashboardData();
    } catch (error) {
      alert('삭제에 실패했습니다.');
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('ERP 시스템에서 로그아웃 하시겠습니까?')) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/login');
    } catch (error: any) {
      alert('로그아웃 처리 중 문제가 발생했습니다.');
      console.error(error.message);
    }
  };

  // === 신규: 메모 저장 및 삭제 로직 ===
  const handleSaveMemo = async () => {
    if (!memoContent.trim()) return;
    const newMemo = { id: Date.now().toString(), content: memoContent, type: memoType, created_at: new Date().toISOString() };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session!.user.id).single();

      const { error } = await supabase.from('dashboard_memos').insert([{ company_id: profile!.company_id, content: memoContent, type: memoType }]);
      if (error) throw error;
      setMemos([newMemo, ...memos]);
    } catch (err) {
      const updated = [newMemo, ...memos];
      setMemos(updated);
      localStorage.setItem('jtech_memos', JSON.stringify(updated));
    }
    setMemoContent('');
  };

  const handleDeleteMemo = async (id: string) => {
    try {
      await supabase.from('dashboard_memos').delete().eq('id', id);
      setMemos(memos.filter(m => m.id !== id));
    } catch (err) {
      const updated = memos.filter(m => m.id !== id);
      setMemos(updated);
      localStorage.setItem('jtech_memos', JSON.stringify(updated));
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        
        {/* 상단 헤더 영역 (기존 유지) */}
        <header className="bg-white p-4 md:p-6 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-start md:items-center border-l-4 border-blue-600 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">J-TECH 통합 ERP 시스템</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">환영합니다! 원하시는 업무를 좌측 메뉴에서 선택해주세요.</p>
          </div>
          
          <div className="flex w-full md:w-auto gap-2">
            <Link 
              href="/company"
              className="flex-1 md:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg border border-blue-200 transition shadow-sm flex items-center justify-center gap-2"
            >
              <span>⚙️</span> <span className="hidden md:inline">내 회사 설정</span><span className="md:hidden">설정</span>
            </Link>
            <button 
              onClick={handleLogout}
              className="flex-1 md:flex-none bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg border border-gray-300 hover:border-red-300 transition shadow-sm flex items-center justify-center gap-2"
            >
              <span>🔒</span> 로그아웃
            </button>
          </div>
        </header>

        {/* 매출 카드 (기존 디자인 및 데이터 유지) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-indigo-500 flex items-center justify-between transition hover:shadow-lg">
            <div>
              <p className="text-sm md:text-base font-bold text-gray-500 mb-1">{new Date().getFullYear()}년 누적 순매출액 (공급가)</p>
              <p className="text-3xl md:text-4xl font-extrabold text-gray-900">{yearlySales.toLocaleString()}<span className="text-xl md:text-2xl text-gray-600 font-bold ml-1">원</span></p>
            </div>
            <div className="text-5xl opacity-20">📈</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-teal-500 flex items-center justify-between transition hover:shadow-lg">
            <div>
              <p className="text-sm md:text-base font-bold text-gray-500 mb-1">{new Date().getMonth() + 1}월 당월 순매출액 (공급가)</p>
              <p className="text-3xl md:text-4xl font-extrabold text-teal-700">{monthlySales.toLocaleString()}<span className="text-xl md:text-2xl text-teal-600 font-bold ml-1">원</span></p>
            </div>
            <div className="text-5xl opacity-20">💰</div>
          </div>
        </div>

        {/* === 핵심 변경: 6개 버튼 자리에 공지/메모장 삽입 === */}
        <div className="bg-white p-6 shadow-lg rounded-xl border border-gray-200 border-t-4 border-purple-600">
          <div className="flex justify-between items-center mb-6 border-b border-dashed border-gray-300 pb-3">
            <div>
              <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                <span>📢</span> 공지 및 업무 메모장
              </h2>
              <p className="text-sm text-gray-500 font-bold mt-1">업체 특이사항, 납품일자, 사내 공유 사항을 기록하세요.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/3 bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-inner">
              <label className="block text-sm font-bold text-gray-700 mb-2">분류 선택</label>
              <select value={memoType} onChange={(e)=>setMemoType(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 mb-4 font-bold outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white">
                <option value="공지사항">📢 사내 공지사항</option>
                <option value="납품일정">🚚 주요 납품일정</option>
                <option value="특이사항">⚠️ 업체 특이사항</option>
              </select>

              <label className="block text-sm font-bold text-gray-700 mb-2">내용 입력</label>
              <textarea value={memoContent} onChange={(e)=>setMemoContent(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 mb-4 h-32 resize-none font-medium outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white" placeholder="내용을 작성하세요..."></textarea>
              <button onClick={handleSaveMemo} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-3 rounded-lg shadow-md transition">등록하기</button>
            </div>

            <div className="w-full md:w-2/3">
               <div className="space-y-3 h-[320px] overflow-y-auto pr-2 border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                 {memos.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-lg">등록된 업무 알림이 없습니다.</div>
                 ) : (
                    memos.map(memo => (
                      <div key={memo.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-start gap-4 hover:border-purple-300 transition group">
                        <div className={`px-3 py-1.5 rounded-md text-xs font-extrabold shrink-0 shadow-sm ${memo.type === '납품일정' ? 'bg-blue-100 text-blue-700 border border-blue-200' : memo.type === '특이사항' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                          {memo.type}
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-800 font-bold whitespace-pre-wrap leading-relaxed text-sm md:text-base">{memo.content}</p>
                          <p className="text-xs text-gray-400 mt-2 font-medium">{new Date(memo.created_at).toLocaleString()}</p>
                        </div>
                        <button onClick={() => handleDeleteMemo(memo.id)} className="text-gray-300 hover:text-red-500 font-bold text-2xl px-2 opacity-0 group-hover:opacity-100 transition">&times;</button>
                      </div>
                    ))
                 )}
               </div>
            </div>
          </div>
        </div>

        {/* === 공용 자료실 (대표님의 기존 렌더링 로직 완벽 유지) === */}
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center">
                <span className="mr-2">📁</span> J-TECH 공용 자료실
              </h2>
              <p className="text-sm text-gray-500 mt-1">사업자등록증, 통장사본, 제품 카탈로그 등 자주 쓰는 문서를 보관하세요.</p>
            </div>
            <label className={`w-full md:w-auto text-center cursor-pointer whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 font-bold py-3 px-6 rounded shadow transition ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isUploading ? '업로드 중...' : '+ 새 문서 등록'}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>

          {attachments.length === 0 ? (
            <div className="text-center bg-gray-50 rounded-lg py-12 border-2 border-dashed border-gray-300">
              <span className="text-5xl mb-3 block text-gray-400">📭</span>
              <p className="text-gray-500 font-medium text-lg">등록된 공용 문서가 없습니다.</p>
              <p className="text-gray-400 text-sm mt-1">우측 상단의 '+ 새 문서 등록' 버튼을 눌러 파일을 추가해보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attachments.map((file) => (
                <div key={file.id} className="bg-gray-50 border border-gray-200 rounded-lg p-5 flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition group">
                  <div className="flex items-start mb-4">
                    <span className="text-3xl mr-3">📄</span>
                    <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="font-bold text-gray-800 group-hover:text-blue-600 transition break-all line-clamp-2 leading-tight">
                      {file.file_name}
                    </a>
                  </div>
                  <div className="flex justify-between items-center mt-auto border-t pt-3">
                    <span className="text-xs font-medium text-gray-400">{new Date(file.created_at).toLocaleDateString()}</span>
                    <button onClick={() => handleDeleteFile(file.id, file.file_path)} className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-100 bg-red-50 px-3 py-1.5 rounded transition">
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}