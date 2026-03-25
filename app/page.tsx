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
  
  const [currentCalMonth, setCurrentCalMonth] = useState(new Date());

  const [activeMemoTab, setActiveMemoTab] = useState<'전체' | '공지사항' | '특이사항' | '납품일정'>('전체');
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);

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

  const openMemoModalNew = () => {
    setEditingMemoId(null);
    setMemoContent('');
    setMemoType('공지사항');
    setMemoDate(getTodayKST());
    setIsMemoModalOpen(true);
  };

  const openMemoModalForDate = (dateStr: string) => {
    setEditingMemoId(null);
    setMemoContent('');
    setMemoType('납품일정'); 
    setMemoDate(dateStr);
    setIsMemoModalOpen(true);
  };

  const closeMemoModal = () => {
    setIsMemoModalOpen(false);
    setEditingMemoId(null);
    setMemoContent('');
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
      
      closeMemoModal(); 

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
    setCurrentCalMonth(new Date(localDateStr));
    
    setIsMemoModalOpen(true); 
  };

  const handleDeleteMemo = async (id: string) => {
    if (!window.confirm('이 알림을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('dashboard_memos').delete().eq('id', id);
      if (error) throw error;
      
      setMemos(memos.filter(m => m.id !== id));
      if (editingMemoId === id) closeMemoModal();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  const groupedAndFilteredMemos = useMemo(() => {
    const filtered = memos.filter(memo => {
      if (activeMemoTab === '전체') return memo.type !== '납품일정';
      return memo.type === activeMemoTab;
    });

    const groups: Record<string, Memo[]> = {};
    filtered.forEach(memo => {
      const dateObj = new Date(memo.created_at);
      const dateStr = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(memo);
    });
    return groups;
  }, [memos, activeMemoTab]);

  const getProductName = (items: { name: string }[]) => {
    if (!items || items.length === 0) return '품목 없음';
    if (items.length === 1) return items[0].name;
    return `${items[0].name} 외 ${items.length - 1}건`;
  };

  const daysInMonth = new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth(), 1).getDay();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const calendarBlanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black overflow-x-hidden relative">
      
      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }
        `
      }} />

      {/* 등록/수정 팝업(모달) */}
      {isMemoModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={closeMemoModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border-2 border-purple-200 p-6 w-full max-w-lg animate-fade-in-up z-10">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <span>{editingMemoId ? '✏️' : '✍️'}</span> {editingMemoId ? '일정/공지 수정' : '새 일정/공지 등록'}
              </h2>
              <button onClick={closeMemoModal} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="w-full sm:w-1/2">
                <label className="block text-sm font-bold text-gray-700 mb-1">날짜 선택</label>
                <input type="date" value={memoDate} onChange={(e) => setMemoDate(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 text-sm font-bold outline-none bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
              </div>
              <div className="w-full sm:w-1/2">
                <label className="block text-sm font-bold text-gray-700 mb-1">분류 선택</label>
                <select value={memoType} onChange={(e)=>setMemoType(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 text-sm font-bold outline-none bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500">
                  <option value="공지사항">📢 공지사항</option>
                  <option value="납품일정">🚚 납품일정</option>
                  <option value="특이사항">⚠️ 특이사항</option>
                </select>
              </div>
            </div>

            <label className="block text-sm font-bold text-gray-700 mb-1">내용 입력</label>
            <textarea value={memoContent} onChange={(e)=>setMemoContent(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 mb-6 h-32 resize-none text-sm font-medium outline-none bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500" placeholder="내용을 상세히 작성하세요..."></textarea>
            
            <div className="flex justify-end gap-3 mt-2">
              <button onClick={closeMemoModal} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition">취소</button>
              <button onClick={handleSaveMemo} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-lg shadow-md transition">
                {editingMemoId ? '수정 완료' : '등록하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[95%] xl:max-w-[1600px] mx-auto space-y-6">
        
        <header className="bg-white p-4 md:p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center border-l-4 border-blue-600 gap-4 mt-12 lg:mt-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">J-TECH 통합 ERP 시스템</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">오늘도 활기찬 하루 되십시오! 원하시는 업무를 선택해주세요.</p>
          </div>
          
          <div className="flex w-full md:w-auto gap-2">
            <Link href="/company" className="flex-1 md:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2.5 px-5 rounded-lg border border-blue-200 transition shadow-sm flex items-center justify-center gap-2">
              <span>⚙️</span> <span className="hidden md:inline">내 회사 설정</span><span className="md:hidden">설정</span>
            </Link>
            <button onClick={handleLogout} className="flex-1 md:flex-none bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 font-bold py-2.5 px-5 rounded-lg border border-gray-300 hover:border-red-300 transition shadow-sm flex items-center justify-center gap-2">
              <span>🔒</span> 로그아웃
            </button>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* === 좌측 패널 === */}
          <div className="w-full lg:w-1/3 space-y-6 shrink-0 lg:sticky lg:top-6">
            
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

            <div className="bg-white p-5 rounded-xl shadow-lg border-t-4 border-indigo-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                  <span>📄</span> 최근 발행 명세서
                </h2>
                <Link href="/sales" className="text-xs font-bold text-blue-600 hover:underline">전체보기</Link>
              </div>
              <div className="space-y-3">
                {recentInvoices.length === 0 ? (
                  <div className="text-center text-gray-400 font-bold py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">발행된 내역이 없습니다.</div>
                ) : (
                  recentInvoices.map((inv) => (
                    <Link key={inv.id} href={`/sales/${inv.id}`} className="block bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 p-3 rounded-lg transition group shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-extrabold text-gray-900 group-hover:text-blue-700 text-sm truncate pr-2">{inv.clients?.name}</span>
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
          </div>

          {/* === 우측 패널 === */}
          <div className="w-full lg:w-2/3 flex flex-col">
            
            <div className="bg-white p-5 md:p-6 shadow-lg rounded-xl border border-gray-200 min-h-[600px] flex flex-col">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-dashed border-gray-300 pb-4 gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                    <span>{activeMemoTab === '납품일정' ? '📅' : '📢'}</span> J-TECH 업무 현황판
                  </h2>
                  <p className="text-sm text-gray-500 font-bold mt-1">
                    {activeMemoTab === '납품일정' ? '월간 납품 일정을 한눈에 확인하세요.' : '사내 공지와 주요 알림을 확인하세요.'}
                  </p>
                </div>
                
                <button 
                  onClick={openMemoModalNew} 
                  className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2.5 px-5 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5 shrink-0"
                >
                  <span className="text-lg">➕</span> 새 일정/공지 등록
                </button>
              </div>

              {/* === 수정: 탭 순서 변경 (납품일정이 맨 끝으로) === */}
              <div className="flex gap-2 mb-4 pb-2 overflow-x-auto shrink-0 custom-scrollbar">
                {['전체', '공지사항', '특이사항', '납품일정'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveMemoTab(tab as any)}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm whitespace-nowrap ${
                      activeMemoTab === tab 
                        ? (tab === '납품일정' ? 'bg-blue-600 text-white border border-blue-700' : 'bg-purple-600 text-white border border-purple-700') 
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {tab === '전체' ? '🌐 전체 보기' : tab === '공지사항' ? '📢 공지사항' : tab === '특이사항' ? '⚠️ 특이사항' : '📅 납품일정 달력'}
                  </button>
                ))}
              </div>

              {/* 타임라인 뷰 ('납품일정' 아닐 때) */}
              {activeMemoTab !== '납품일정' && (
                <div className="flex-1 flex flex-col animate-fade-in-up">
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-gray-50/50 p-2 md:p-4 rounded-xl border border-gray-100 relative min-h-[400px]">
                    {Object.keys(groupedAndFilteredMemos).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-lg p-10">
                        <span className="text-5xl mb-3 opacity-40">📭</span>
                        <p className="text-lg">등록된 내용이 없습니다.</p>
                      </div>
                    ) : (
                      Object.entries(groupedAndFilteredMemos).map(([dateStr, dateMemos]) => (
                        <div key={dateStr} className="mb-8 last:mb-2">
                          <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 py-2 mb-4 flex items-center gap-3">
                            <span className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded-full text-sm font-extrabold shadow-sm border border-gray-300">📅 {dateStr}</span>
                            <div className="flex-1 h-px bg-gray-300"></div>
                          </div>

                          <div className="space-y-4 pl-1 lg:pl-3">
                            {dateMemos.map(memo => (
                              <div key={memo.id} className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start gap-3 md:gap-4 transition hover:border-purple-300 hover:shadow-md group relative">
                                
                                <div className="flex justify-between w-full sm:w-auto">
                                  <div className={`px-3 py-1.5 rounded-md text-xs font-extrabold shrink-0 shadow-sm ${memo.type === '특이사항' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                    {memo.type}
                                  </div>
                                  <div className="flex gap-1 sm:hidden opacity-100">
                                    <button onClick={() => handleEditClick(memo)} className="text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 w-7 h-7 flex items-center justify-center font-bold text-sm border border-gray-200 rounded shadow-sm">✏️</button>
                                    <button onClick={() => handleDeleteMemo(memo.id)} className="text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 w-7 h-7 flex items-center justify-center font-bold text-lg border border-gray-200 rounded shadow-sm">&times;</button>
                                  </div>
                                </div>
                                
                                <div className="flex-1 w-full min-w-0 pr-0 sm:pr-20">
                                  <p className="text-gray-900 font-bold whitespace-pre-wrap leading-relaxed text-sm md:text-base break-words">{memo.content}</p>
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
              )}

              {/* 달력 뷰 ('납품일정' 탭일 때) */}
              {activeMemoTab === '납품일정' && (
                <div className="flex-1 flex flex-col animate-fade-in-up min-h-[500px]">
                  
                  <div className="flex justify-between items-center mb-4 bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm">
                    <button onClick={() => setCurrentCalMonth(new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() - 1, 1))} className="p-2 font-bold text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition border border-transparent hover:border-gray-200 shadow-sm text-sm">&lt; 이전달</button>
                    <span className="font-extrabold text-blue-900 text-lg md:text-xl">{currentCalMonth.getFullYear()}년 {currentCalMonth.getMonth() + 1}월</span>
                    <button onClick={() => setCurrentCalMonth(new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() + 1, 1))} className="p-2 font-bold text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition border border-transparent hover:border-gray-200 shadow-sm text-sm">다음달 &gt;</button>
                  </div>
                  
                  <div className="flex-1 overflow-x-auto custom-scrollbar border border-gray-200 rounded-xl bg-white flex flex-col shadow-inner">
                    <div className="min-w-[700px] flex-1 flex flex-col">
                      <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200 shrink-0">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                          <div key={day} className={`p-3 text-center text-sm font-extrabold ${i===0 ? 'text-red-500' : i===6 ? 'text-blue-500' : 'text-gray-700'}`}>{day}</div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                        {calendarBlanks.map(b => <div key={`blank-${b}`} className="border-b border-r border-gray-100 bg-gray-50/50 p-2 min-h-[100px] md:min-h-[120px]"></div>)}
                        {calendarDays.map(d => {
                          const dateStr = `${currentCalMonth.getFullYear()}-${String(currentCalMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const isToday = dateStr === getTodayKST();
                          
                          const dayMemos = memos.filter(m => {
                             if (m.type !== '납품일정') return false; 
                             const mDate = new Date(m.created_at);
                             const offset = mDate.getTimezoneOffset() * 60000;
                             const mDateStr = new Date(mDate.getTime() - offset).toISOString().slice(0, 10);
                             return mDateStr === dateStr;
                          });

                          return (
                            <div 
                              key={d} 
                              onClick={() => openMemoModalForDate(dateStr)} 
                              className={`border-b border-r border-gray-100 p-2 min-h-[100px] md:min-h-[120px] cursor-pointer transition group flex flex-col gap-1 ${isToday ? 'bg-blue-50/30' : 'hover:bg-blue-50/20'}`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs md:text-sm font-bold w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 group-hover:text-blue-600'}`}>{d}</span>
                              </div>
                              
                              <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                                {dayMemos.map(m => (
                                  <div 
                                    key={m.id} 
                                    onClick={(e) => { e.stopPropagation(); handleEditClick(m); }} 
                                    className="text-[11px] md:text-xs font-bold px-1.5 py-1 rounded truncate border shadow-sm transition hover:scale-[1.02] cursor-pointer bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                                    title={m.content}
                                  >
                                    🚚 {m.content}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 font-bold mt-3 text-right">
                    * 달력의 날짜를 클릭하면 해당 일자에 바로 일정을 등록할 수 있습니다.
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}