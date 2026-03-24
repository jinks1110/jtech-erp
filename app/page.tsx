"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Memo {
  id: string;
  content: string;
  type: string;
  created_at: string;
}

interface RecentInvoice {
  id: string;
  invoice_no: string;
  created_at: string;
  total_amount: number;
  clients: { name: string };
  // === 핵심 수정 1: 품목 정보를 가져오기 위한 인터페이스 추가 ===
  invoice_items: { name: string }[];
}

export default function MainPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);

  const [memos, setMemos] = useState<Memo[]>([]);
  const [memoContent, setMemoContent] = useState('');
  const [memoType, setMemoType] = useState('공지사항');
  
  const getTodayKST = () => {
    const offset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - offset).toISOString().slice(0, 10);
  };
  const [memoDate, setMemoDate] = useState(getTodayKST());
  
  const [activeMemoTab, setActiveMemoTab] = useState<'전체' | '공지사항' | '납품일정' | '특이사항'>('전체');
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);

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
      
      setCompanyId(profile.company_id);

      // === 핵심 수정 2: invoice_items(name) 도 함께 불러오도록 쿼리 수정 ===
      const { data: recentData } = await supabase
        .from('invoices')
        .select('id, invoice_no, created_at, total_amount, clients(name), invoice_items(name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(3);
        
      if (recentData) {
        setRecentInvoices(recentData as unknown as RecentInvoice[]);
      }

      const { data: memoData, error: memoError } = await supabase
        .from('dashboard_memos')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });
        
      if (!memoError && memoData) {
        setMemos(memoData);
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

  useEffect(() => {
    if (!companyId) return;

    const fetchMemosOnly = async () => {
      const { data } = await supabase
        .from('dashboard_memos')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (data) {
        setMemos(data);
      }
    };

    const intervalId = setInterval(fetchMemosOnly, 5000); 
    return () => clearInterval(intervalId); 
  }, [companyId]);

  const handleLogout = async () => {
    if (!window.confirm('ERP 시스템에서 로그아웃 하시겠습니까?')) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/login');
    } catch (error: any) {
      alert('로그아웃 처리 중 문제가 발생했습니다.');
    }
  };

  const handleSaveMemo = async () => {
    if (!memoContent.trim()) return;
    
    try {
      if (!companyId) return;

      const finalCreatedAt = new Date(`${memoDate}T09:00:00+09:00`).toISOString();

      if (editingMemoId) {
        const { error } = await supabase
          .from('dashboard_memos')
          .update({ content: memoContent, type: memoType, created_at: finalCreatedAt })
          .eq('id', editingMemoId);
        
        if (error) throw error;
        
        setMemos(memos.map(m => m.id === editingMemoId ? { ...m, content: memoContent, type: memoType, created_at: finalCreatedAt } : m));
        setEditingMemoId(null);
        alert('알림이 성공적으로 수정되었습니다.');
      } else {
        const { data, error } = await supabase
          .from('dashboard_memos')
          .insert([{ company_id: companyId, content: memoContent, type: memoType, created_at: finalCreatedAt }])
          .select()
          .single();
        
        if (error) throw error;
        setMemos([data, ...memos].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
      
      setMemoContent('');
      setMemoType('공지사항');
      setMemoDate(getTodayKST()); 

    } catch (err: any) {
      console.error(err);
      alert(`저장 실패: ${err.message}`);
    }
  };

  const handleEditClick = (memo: Memo) => {
    setMemoType(memo.type);
    setMemoContent(memo.content);
    setEditingMemoId(memo.id);
    
    const existingDate = new Date(memo.created_at);
    const offset = existingDate.getTimezoneOffset() * 60000;
    const localDateStr = new Date(existingDate.getTime() - offset).toISOString().slice(0, 10);
    setMemoDate(localDateStr);
  };

  const handleCancelEdit = () => {
    setEditingMemoId(null);
    setMemoContent('');
    setMemoType('공지사항');
    setMemoDate(getTodayKST());
  };

  const handleDeleteMemo = async (id: string) => {
    if (!window.confirm('이 알림을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('dashboard_memos').delete().eq('id', id);
      if (error) throw error;
      
      setMemos(memos.filter(m => m.id !== id));
      if (editingMemoId === id) handleCancelEdit();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  const groupedAndFilteredMemos = useMemo(() => {
    const filtered = memos.filter(memo => activeMemoTab === '전체' || memo.type === activeMemoTab);
    const groups: Record<string, Memo[]> = {};
    filtered.forEach(memo => {
      const dateObj = new Date(memo.created_at);
      const dateStr = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(memo);
    });
    return groups;
  }, [memos, activeMemoTab]);

  // === 핵심 수정 3: 품목명 파싱 함수 추가 ===
  const getProductName = (items: { name: string }[]) => {
    if (!items || items.length === 0) return '품목 없음';
    if (items.length === 1) return items[0].name;
    return `${items[0].name} 외 ${items.length - 1}건`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">데이터를 불러오는 중입니다...</div>;

  return (
    // === 핵심 수정 4: 전체 레이아웃을 max-w-[1600px] 와이드 폼으로 확장 ===
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black overflow-x-hidden">
      
      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        `
      }} />

      <div className="max-w-[95%] xl:max-w-[1600px] mx-auto space-y-6">
        
        {/* 상단 헤더 */}
        <header className="bg-white p-4 md:p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center border-l-4 border-blue-600 gap-4 mt-12 lg:mt-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">J-TECH 통합 ERP 시스템</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">오늘도 활기찬 하루 되십시오! 원하시는 업무를 선택해주세요.</p>
          </div>
          
          <div className="flex w-full md:w-auto gap-2">
            <Link 
              href="/company"
              className="flex-1 md:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2.5 px-5 rounded-lg border border-blue-200 transition shadow-sm flex items-center justify-center gap-2"
            >
              <span>⚙️</span> <span className="hidden md:inline">내 회사 설정</span><span className="md:hidden">설정</span>
            </Link>
            <button 
              onClick={handleLogout}
              className="flex-1 md:flex-none bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 font-bold py-2.5 px-5 rounded-lg border border-gray-300 hover:border-red-300 transition shadow-sm flex items-center justify-center gap-2"
            >
              <span>🔒</span> 로그아웃
            </button>
          </div>
        </header>

        {/* === 핵심 수정 5: 좌측 1/3 (컨트롤), 우측 2/3 (데이터) 레이아웃 적용 === */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* =========================================================================
              좌측 패널 (lg:w-1/3) : 빠른 메뉴 + 최근 명세서 + 알림 입력 폼
          ========================================================================= */}
          <div className="w-full lg:w-1/3 space-y-6 shrink-0 lg:sticky lg:top-6">
            
            {/* 1. 빠른 업무 바로가기 */}
            <div className="bg-white p-5 rounded-xl shadow-lg border-t-4 border-blue-500">
              <h2 className="text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-2">
                <span>🚀</span> 빠른 업무 바로가기
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/invoice" className="bg-blue-50 hover:bg-blue-100 border border-blue-200 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition group shadow-sm">
                  <span className="text-3xl group-hover:scale-110 transition-transform">✍️</span>
                  <span className="font-bold text-blue-800 text-sm">명세서 작성</span>
                </Link>
                <Link href="/sales" className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition group shadow-sm">
                  <span className="text-3xl group-hover:scale-110 transition-transform">📊</span>
                  <span className="font-bold text-indigo-800 text-sm">매출 조회</span>
                </Link>
                <Link href="/clients" className="bg-teal-50 hover:bg-teal-100 border border-teal-200 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition group shadow-sm">
                  <span className="text-3xl group-hover:scale-110 transition-transform">🏢</span>
                  <span className="font-bold text-teal-800 text-sm">거래처 관리</span>
                </Link>
                <Link href="/products" className="bg-amber-50 hover:bg-amber-100 border border-amber-200 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition group shadow-sm">
                  <span className="text-3xl group-hover:scale-110 transition-transform">📦</span>
                  <span className="font-bold text-amber-800 text-sm">품목 관리</span>
                </Link>
              </div>
            </div>

            {/* 2. 최근 발행 명세서 */}
            <div className="bg-white p-5 rounded-xl shadow-lg border-t-4 border-indigo-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                  <span>📄</span> 최근 발행 명세서
                </h2>
                <Link href="/sales" className="text-xs font-bold text-blue-600 hover:underline">전체보기</Link>
              </div>
              
              <div className="space-y-3">
                {recentInvoices.length === 0 ? (
                  <div className="text-center text-gray-400 font-bold py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    발행된 내역이 없습니다.
                  </div>
                ) : (
                  recentInvoices.map((inv) => (
                    <Link key={inv.id} href={`/sales/${inv.id}`} className="block bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 p-3 rounded-lg transition group shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-extrabold text-gray-900 group-hover:text-blue-700 text-sm truncate pr-2">{inv.clients?.name}</span>
                        {/* === 핵심 수정 6: 문서번호 대신 품목 요약이 나오도록 변경 === */}
                        <span className="text-xs font-bold text-gray-500 truncate max-w-[120px]">{getProductName(inv.invoice_items)}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-gray-400 font-bold">{new Date(inv.created_at).toLocaleDateString()}</span>
                        <span className="font-extrabold text-blue-700 text-sm">{inv.total_amount.toLocaleString()}원</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* 3. 공지/알림 등록 폼 */}
            <div className={`p-5 rounded-xl shadow-lg border-t-4 transition-colors ${editingMemoId ? 'bg-yellow-50 border-t-yellow-400 border-l border-r border-b border-yellow-200' : 'bg-white border-t-purple-500 border-l border-r border-b border-gray-200'}`}>
              <h2 className="text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-2">
                <span>✍️</span> {editingMemoId ? '알림 내용 수정' : '새 알림 등록'}
              </h2>
              
              <div className="flex gap-2 mb-4">
                <div className="w-1/2">
                  <label className={`block text-xs font-bold mb-1 ${editingMemoId ? 'text-yellow-700' : 'text-gray-600'}`}>날짜 선택</label>
                  <input type="date" value={memoDate} onChange={(e) => setMemoDate(e.target.value)} className={`w-full p-2 rounded-lg border text-sm font-bold outline-none bg-white ${editingMemoId ? 'border-yellow-400 focus:border-yellow-600' : 'border-gray-300 focus:border-purple-500'}`} />
                </div>
                <div className="w-1/2">
                  <label className={`block text-xs font-bold mb-1 ${editingMemoId ? 'text-yellow-700' : 'text-gray-600'}`}>분류 선택</label>
                  <select value={memoType} onChange={(e)=>setMemoType(e.target.value)} className={`w-full p-2 rounded-lg border text-sm font-bold outline-none bg-white ${editingMemoId ? 'border-yellow-400 focus:border-yellow-600' : 'border-gray-300 focus:border-purple-500'}`}>
                    <option value="공지사항">📢 공지사항</option>
                    <option value="납품일정">🚚 납품일정</option>
                    <option value="특이사항">⚠️ 특이사항</option>
                  </select>
                </div>
              </div>

              <label className={`block text-xs font-bold mb-1 ${editingMemoId ? 'text-yellow-700' : 'text-gray-600'}`}>내용 입력</label>
              <textarea value={memoContent} onChange={(e)=>setMemoContent(e.target.value)} className={`w-full p-3 rounded-lg border mb-4 h-24 resize-none text-sm font-medium outline-none bg-white ${editingMemoId ? 'border-yellow-400 focus:border-yellow-600 focus:ring-1 focus:ring-yellow-600' : 'border-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'}`} placeholder="내용을 작성하세요..."></textarea>
              
              {editingMemoId ? (
                <div className="flex gap-2">
                  <button onClick={handleCancelEdit} className="w-1/3 bg-gray-400 hover:bg-gray-500 text-white font-extrabold py-2.5 rounded-lg shadow transition text-sm">취소</button>
                  <button onClick={handleSaveMemo} className="w-2/3 bg-yellow-500 hover:bg-yellow-600 text-white font-extrabold py-2.5 rounded-lg shadow transition text-sm">수정 완료</button>
                </div>
              ) : (
                <button onClick={handleSaveMemo} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-3 rounded-lg shadow transition text-sm">등록하기</button>
              )}
            </div>

          </div>

          {/* =========================================================================
              우측 패널 (lg:w-2/3) : 공지 및 알림 리스트 뷰 (화면 최상단으로 끌어올림)
          ========================================================================= */}
          <div className="w-full lg:w-2/3 flex flex-col">
            
            <div className="bg-white p-5 md:p-6 shadow-lg rounded-xl border border-gray-200 min-h-[600px] flex flex-col">
              
              <div className="flex justify-between items-center mb-4 border-b border-dashed border-gray-300 pb-3">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                    <span>📢</span> J-TECH 업무 현황판
                  </h2>
                  <p className="text-sm text-gray-500 font-bold mt-1">사내 공지와 주요 일정을 확인하세요.</p>
                </div>
              </div>

              {/* 필터 탭 */}
              <div className="flex gap-2 mb-4 pb-2 overflow-x-auto shrink-0 custom-scrollbar">
                {['전체', '공지사항', '납품일정', '특이사항'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveMemoTab(tab as any)}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm whitespace-nowrap ${
                      activeMemoTab === tab 
                        ? 'bg-purple-600 text-white border border-purple-700' 
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {tab === '전체' ? '🌐 전체 보기' : tab === '공지사항' ? '📢 공지사항' : tab === '납품일정' ? '🚚 납품일정' : '⚠️ 특이사항'}
                  </button>
                ))}
              </div>

              {/* 메모 리스트 (타임라인) */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-gray-50/50 p-2 md:p-4 rounded-xl border border-gray-100 relative">
                {Object.keys(groupedAndFilteredMemos).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-lg p-10">
                    <span className="text-5xl mb-3 opacity-40">📭</span>
                    <p className="text-lg">등록된 내용이 없습니다.</p>
                  </div>
                ) : (
                  Object.entries(groupedAndFilteredMemos).map(([dateStr, dateMemos]) => (
                    <div key={dateStr} className="mb-8 last:mb-2">
                      
                      <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 py-2 mb-4 flex items-center gap-3">
                        <span className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded-full text-sm font-extrabold shadow-sm border border-gray-300">
                          📅 {dateStr}
                        </span>
                        <div className="flex-1 h-px bg-gray-300"></div>
                      </div>

                      <div className="space-y-4 pl-1 lg:pl-3">
                        {dateMemos.map(memo => (
                          <div key={memo.id} className={`bg-white p-4 md:p-5 rounded-xl border shadow-sm flex flex-col sm:flex-row items-start gap-3 md:gap-4 transition group relative ${editingMemoId === memo.id ? 'border-yellow-400 shadow-md bg-yellow-50/30' : 'border-gray-200 hover:border-purple-300 hover:shadow-md'}`}>
                            
                            <div className="flex justify-between w-full sm:w-auto">
                              <div className={`px-3 py-1.5 rounded-md text-xs font-extrabold shrink-0 shadow-sm ${memo.type === '납품일정' ? 'bg-blue-100 text-blue-700 border border-blue-200' : memo.type === '특이사항' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                {memo.type}
                              </div>
                              <div className="flex gap-1 sm:hidden opacity-100">
                                <button onClick={() => handleEditClick(memo)} className="text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 w-7 h-7 flex items-center justify-center font-bold text-sm border border-gray-200 rounded shadow-sm">✏️</button>
                                <button onClick={() => handleDeleteMemo(memo.id)} className="text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 w-7 h-7 flex items-center justify-center font-bold text-lg border border-gray-200 rounded shadow-sm">&times;</button>
                              </div>
                            </div>
                            
                            <div className="flex-1 w-full min-w-0 pr-0 sm:pr-20">
                              <p className="text-gray-900 font-bold whitespace-pre-wrap leading-relaxed text-sm md:text-base break-words">
                                {memo.content}
                              </p>
                            </div>

                            <div className="hidden sm:flex absolute right-4 top-4 gap-1.5 opacity-0 group-hover:opacity-100 transition">
                              <button onClick={() => handleEditClick(memo)} className="text-gray-500 hover:text-blue-600 bg-white hover:bg-blue-50 w-8 h-8 rounded flex items-center justify-center font-bold text-sm transition border border-gray-200 shadow-sm">✏️</button>
                              <button onClick={() => handleDeleteMemo(memo.id)} className="text-gray-500 hover:text-red-600 bg-white hover:bg-red-50 w-8 h-8 rounded flex items-center justify-center font-bold text-xl transition border border-gray-200 shadow-sm">&times;</button>
                            </div>

                          </div>
                        ))}
                      </div>
                    </div>
                  ))
               )}
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}