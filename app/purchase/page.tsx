"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Client { id: string; name: string; }
interface PurchaseItem { name: string; qty: number; price: number; spec?: string; }
interface Purchase {
  id: string; purchase_no: string; created_at: string;
  supply_amount: number; vat_amount: number; total_amount: number;
  client_id: string; clients: { name: string; }; purchase_items: PurchaseItem[];
}

export default function PurchaseListPage() {
  const router = useRouter(); 
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'list' | 'summary' | 'items'>('list');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterWrapperRef = useRef<HTMLDivElement>(null);

  const [quickYear, setQuickYear] = useState(new Date().getFullYear().toString());
  const [quickMonth, setQuickMonth] = useState((new Date().getMonth() + 1).toString());
  const [cutoffType, setCutoffType] = useState<'endOfMonth' | '25th'>('endOfMonth');

  const [companyName, setCompanyName] = useState('J-TECH');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isInitialized, setIsInitialized] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', desc: '', confirmText: '확인', confirmColor: 'bg-green-600 hover:bg-green-700', onConfirm: async () => {} });
  const closeModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const applyQuickFilter = (year: string, month: string, cutoff: 'endOfMonth' | '25th') => {
    if (!year) return;
    if (!month) {
      if (cutoff === 'endOfMonth') { setStartDate(`${year}-01-01`); setEndDate(`${year}-12-31`); } 
      else { setStartDate(`${Number(year) - 1}-12-26`); setEndDate(`${year}-12-25`); }
    } else {
      const y = Number(year); const m = Number(month);
      if (cutoff === 'endOfMonth') {
        const paddedMonth = String(m).padStart(2, '0'); const lastDay = new Date(y, m, 0).getDate();
        setStartDate(`${year}-${paddedMonth}-01`); setEndDate(`${year}-${paddedMonth}-${lastDay}`);
      } else {
        let prevYear = y; let prevMonth = m - 1;
        if (prevMonth === 0) { prevYear = y - 1; prevMonth = 12; }
        const paddedPrevMonth = String(prevMonth).padStart(2, '0'); const paddedCurrentMonth = String(m).padStart(2, '0');
        setStartDate(`${prevYear}-${paddedPrevMonth}-26`); setEndDate(`${year}-${paddedCurrentMonth}-25`);
      }
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('jtech_purchase_filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
        if (parsed.startDate) setStartDate(parsed.startDate);
        if (parsed.endDate) setEndDate(parsed.endDate);
        if (parsed.selectedClientId !== undefined) setSelectedClientId(parsed.selectedClientId);
        if (parsed.filterSearchTerm !== undefined) setFilterSearchTerm(parsed.filterSearchTerm);
        if (parsed.quickYear) setQuickYear(parsed.quickYear);
        if (parsed.quickMonth !== undefined) setQuickMonth(parsed.quickMonth);
        if (parsed.cutoffType) setCutoffType(parsed.cutoffType);
        if (parsed.sortOrder) setSortOrder(parsed.sortOrder);
      } catch (e) { applyQuickFilter(quickYear, quickMonth, cutoffType); }
    } else { applyQuickFilter(quickYear, quickMonth, cutoffType); }
    setIsInitialized(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isInitialized) sessionStorage.setItem('jtech_purchase_filters', JSON.stringify({ activeTab, startDate, endDate, selectedClientId, filterSearchTerm, quickYear, quickMonth, cutoffType, sortOrder }));
  }, [isInitialized, activeTab, startDate, endDate, selectedClientId, filterSearchTerm, quickYear, quickMonth, cutoffType, sortOrder]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (filterWrapperRef.current && !filterWrapperRef.current.contains(event.target as Node)) setShowFilterDropdown(false); };
    document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => { const y = e.target.value; setQuickYear(y); applyQuickFilter(y, quickMonth, cutoffType); };
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => { const m = e.target.value; setQuickMonth(m); applyQuickFilter(quickYear, m, cutoffType); };
  const handleCutoffChange = (type: 'endOfMonth' | '25th') => { setCutoffType(type); applyQuickFilter(quickYear, quickMonth, type); };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();

      const { data: compData } = await supabase.from('companies').select('name').eq('id', profile!.company_id).single();
      if (compData) setCompanyName(compData.name);

      const { data: clientsData } = await supabase.from('clients').select('id, name').eq('company_id', profile!.company_id).eq('is_active', true).order('name');
      if (clientsData) setClients(clientsData);

      let query = supabase.from('purchases').select(`id, purchase_no, created_at, supply_amount, vat_amount, total_amount, client_id, clients(name), purchase_items(name, spec, qty, price)`).eq('company_id', profile!.company_id).order('created_at', { ascending: sortOrder === 'asc' });

      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00Z`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59Z`);
      if (selectedClientId) query = query.eq('client_id', selectedClientId);

      const { data, error } = await query;
      if (error) throw error;
      setPurchases(data as unknown as Purchase[]);
      
    } catch { 
      // 에러 무시
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { if (startDate) fetchData(); }, [startDate, endDate, selectedClientId, sortOrder]);

  const toggleSort = () => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  const getProductName = (items: { name: string }[]) => { if (!items || items.length === 0) return '품목 없음'; return items.length === 1 ? items[0].name : `${items[0].name} 외 ${items.length - 1}건`; };
  const getFullItemsDetails = (items: { name: string, qty: number }[]) => { return items?.map(item => `${item.name}(${item.qty})`).join(', ') || '품목 없음'; };

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true, title: '매입 내역 삭제', desc: '정말 이 매입 내역을 삭제하시겠습니까?', confirmText: '삭제하기', confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => { closeModal(); try { await supabase.from('purchase_items').delete().eq('purchase_id', id); await supabase.from('purchases').delete().eq('id', id); fetchData(); } catch (error) { alert('삭제 실패'); } }
    });
  };

  const clientSummary = useMemo(() => {
    const summary: Record<string, { id: string, name: string, supply: number, vat: number, total: number, count: number }> = {};
    purchases.forEach(p => {
      const cName = p.clients?.name || '알 수 없음';
      if (!summary[cName]) summary[cName] = { id: p.client_id, name: cName, supply: 0, vat: 0, total: 0, count: 0 };
      summary[cName].supply += p.supply_amount; summary[cName].vat += p.vat_amount; summary[cName].total += p.total_amount; summary[cName].count += 1;
    });
    return Object.values(summary).sort((a, b) => b.total - a.total);
  }, [purchases]);

  const detailedItems = useMemo(() => {
    const itemsList: any[] = [];
    purchases.forEach(p => { 
      p.purchase_items.forEach(item => { 
        itemsList.push({ 
          purchase_id: p.id, 
          created_at: p.created_at, 
          purchase_no: p.purchase_no, 
          client_name: p.clients?.name, 
          item_name: item.name, 
          qty: item.qty, 
          price: item.price 
        }); 
      }); 
    });
    return itemsList;
  }, [purchases]);

  const totalSupply = purchases.reduce((sum, p) => sum + (p.supply_amount || 0), 0);
  const totalVat = purchases.reduce((sum, p) => sum + (p.vat_amount || 0), 0);
  const grandTotal = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const currentYearNum = new Date().getFullYear();
  const yearOptions = Array.from({length: 5}, (_, i) => currentYearNum - 2 + i); 

  const filteredSearchClients = clients.filter(c => c.name.toLowerCase().includes(filterSearchTerm.toLowerCase()));

  const handleTabChange = (tab: 'list' | 'summary' | 'items') => {
    if (tab === 'summary' || tab === 'items') { setSelectedClientId(''); setFilterSearchTerm(''); }
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 pt-16 lg:p-4 lg:pt-8 text-black print:bg-white print:p-0 relative">
      
      {/* 기본 알림/확인 모달 */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 print:hidden">
          <div className="absolute inset-0 bg-gray-900/10 backdrop-blur-[2px]" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 whitespace-pre-line text-sm leading-relaxed">{confirmModal.desc}</p>
            <div className="flex justify-end gap-3"><button onClick={closeModal} className="px-4 py-2 rounded-lg font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">취소</button><button onClick={confirmModal.onConfirm} className={`px-4 py-2 rounded-lg font-bold text-white transition shadow-md ${confirmModal.confirmColor}`}>{confirmModal.confirmText}</button></div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4 landscape; margin: 15mm; } body { background-color: white !important; print-color-adjust: exact; } .print-hidden { display: none !important; } } @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }` }} />

      <div className="max-w-[95%] xl:max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 print:hidden">
        
        {/* 좌측 패널: 필터 영역 */}
        <div className="w-full lg:w-1/4 space-y-4 shrink-0">
          <div className="bg-white p-5 md:p-6 shadow-lg rounded-lg border-t-4 border-green-600 lg:sticky lg:top-6">
            <div className="mb-4 border-b pb-4"><h1 className="text-xl md:text-2xl font-extrabold">매입 내역 조회</h1><p className="text-gray-500 text-sm mt-1 font-bold">기간 및 매입처별 데이터 분석</p></div>
            
            <div className="flex flex-col gap-2 mb-6">
              <button onClick={() => handleTabChange('summary')} className={`text-left p-3 rounded-lg font-bold transition flex items-center gap-2 ${activeTab === 'summary' ? 'bg-green-100 text-green-800 border-l-4 border-green-600' : 'text-gray-600 hover:bg-gray-100'}`}><span>🏢</span> 매입처별 집계</button>
              <button onClick={() => handleTabChange('list')} className={`text-left p-3 rounded-lg font-bold transition flex items-center gap-2 ${activeTab === 'list' ? 'bg-green-100 text-green-800 border-l-4 border-green-600' : 'text-gray-600 hover:bg-gray-100'}`}><span>📄</span> 매입 전표 목록</button>
              <button onClick={() => handleTabChange('items')} className={`text-left p-3 rounded-lg font-bold transition flex items-center gap-2 ${activeTab === 'items' ? 'bg-green-100 text-green-800 border-l-4 border-green-600' : 'text-gray-600 hover:bg-gray-100'}`}><span>📦</span> 품목별 상세 내역</button>
            </div>

            <div className="h-px bg-gray-200 my-4"></div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">마감 기준 & 년월 선택</label>
                <div className="flex bg-gray-100 rounded-lg p-1 mb-2">
                  <button onClick={() => handleCutoffChange('endOfMonth')} className={`flex-1 py-1.5 text-xs font-bold rounded ${cutoffType === 'endOfMonth' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}>말일 마감</button>
                  <button onClick={() => handleCutoffChange('25th')} className={`flex-1 py-1.5 text-xs font-bold rounded ${cutoffType === '25th' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}>25일 마감</button>
                </div>
                <div className="flex gap-2">
                  <select value={quickYear} onChange={handleYearChange} className="flex-1 border rounded-lg p-2 text-sm outline-none focus:border-green-500 font-bold bg-white text-gray-700">{yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}</select>
                  <select value={quickMonth} onChange={handleMonthChange} className="flex-1 border rounded-lg p-2 text-sm outline-none focus:border-green-500 font-bold bg-white text-gray-700"><option value="">전체 월</option>{Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m.toString()}>{m}월</option>)}</select>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="w-1/2"><label className="block text-xs font-bold text-gray-500 mb-1">시작일</label><input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setQuickMonth(''); }} className="w-full border rounded-lg p-2 text-xs font-bold outline-none focus:border-green-500" /></div>
                <div className="w-1/2"><label className="block text-xs font-bold text-gray-500 mb-1">종료일</label><input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setQuickMonth(''); }} className="w-full border rounded-lg p-2 text-xs font-bold outline-none focus:border-green-500" /></div>
              </div>

              <div className="relative" ref={filterWrapperRef}>
                <label className="block text-sm font-bold text-gray-700 mb-1">매입처 필터</label>
                <input type="text" className="w-full border-2 border-green-200 rounded-lg p-2.5 outline-none focus:border-green-500 bg-white placeholder-gray-400 font-bold" placeholder="전체 매입처 (클릭하여 검색)" value={filterSearchTerm} onChange={(e) => { setFilterSearchTerm(e.target.value); setShowFilterDropdown(true); if (e.target.value === '') setSelectedClientId(''); }} onClick={() => setShowFilterDropdown(true)} />
                {showFilterDropdown && filteredSearchClients.length > 0 && (
                  <ul className="absolute z-20 w-full mt-1 bg-white border-2 border-green-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    <li className="px-4 py-3 hover:bg-green-50 cursor-pointer font-bold border-b text-gray-600 flex items-center justify-between" onClick={() => { setFilterSearchTerm(''); setSelectedClientId(''); setShowFilterDropdown(false); }}><span>전체 보기 (초기화)</span><span>↺</span></li>
                    {filteredSearchClients.map(client => (
                      <li key={client.id} className="px-4 py-3 hover:bg-green-50 cursor-pointer font-extrabold text-green-900 border-b border-gray-100 last:border-b-0" onClick={() => { setFilterSearchTerm(client.name); setSelectedClientId(client.id); setShowFilterDropdown(false); }}>{client.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 우측 패널: 데이터 뷰 */}
        <div className="w-full lg:w-3/4 flex flex-col gap-4 sm:gap-6 overflow-hidden">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-green-500 flex flex-col justify-center"><p className="text-xs font-extrabold text-gray-500 mb-1">총 매입가액</p><p className="text-xl sm:text-2xl font-extrabold text-gray-900">{totalSupply.toLocaleString()}원</p></div>
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-blue-500 flex flex-col justify-center"><p className="text-xs font-extrabold text-gray-500 mb-1">총 매입 부가세</p><p className="text-xl sm:text-2xl font-extrabold text-gray-900">{totalVat.toLocaleString()}원</p></div>
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-green-700 flex flex-col justify-center bg-green-50/30"><p className="text-sm font-extrabold text-green-800 mb-1">총 매입 합계금액</p><p className="text-2xl sm:text-3xl font-extrabold text-green-800">{grandTotal.toLocaleString()}<span className="text-sm sm:text-lg ml-1">원</span></p></div>
          </div>

          <div className="bg-white p-4 md:p-6 shadow-lg rounded-xl flex-grow min-h-[500px]">
            {loading ? (<div className="h-full flex items-center justify-center"><p className="font-bold text-gray-500">데이터를 불러오는 중입니다...</p></div>) : purchases.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-10 mt-4"><span className="text-4xl mb-3 opacity-50">📭</span><p className="text-gray-500 font-bold">해당 조건에 맞는 데이터가 없습니다.</p></div>
            ) : (
              <div className="animate-fade-in-up">
                
                {/* 1. 집계 탭 */}
                {activeTab === 'summary' && (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-300">
                            <th className="p-3 w-16 text-center font-bold">No</th><th className="p-3 font-extrabold text-green-700">매입처명</th><th className="p-3 w-24 text-center font-bold">등록 건수</th>
                            <th className="p-3 w-32 text-right font-bold">공급가액</th><th className="p-3 w-32 text-right font-bold">부가세</th><th className="p-3 w-40 text-right font-extrabold text-green-700">총 매입합계</th>
                            <th className="p-3 text-center w-28 whitespace-nowrap">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientSummary.map((client, idx) => (
                            <tr key={client.id} className="border-b hover:bg-green-50 transition text-sm">
                              <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td><td className="p-3 font-extrabold text-gray-900">{client.name}</td><td className="p-3 text-center font-bold text-gray-600">{client.count}건</td>
                              <td className="p-3 text-right font-bold text-gray-700">{client.supply.toLocaleString()}원</td><td className="p-3 text-right font-bold text-gray-500">{client.vat.toLocaleString()}원</td><td className="p-3 text-right font-extrabold text-green-700 bg-green-50/30">{client.total.toLocaleString()}원</td>
                              <td className="p-3 text-center whitespace-nowrap"><button onClick={() => { setSelectedClientId(client.id); setFilterSearchTerm(client.name); setActiveTab('list'); }} className="bg-white text-green-600 border border-green-200 px-3 py-1.5 rounded text-xs font-bold hover:bg-green-50 shadow-sm whitespace-nowrap">목록 보기</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* 모바일 집계 카드 */}
                    <div className="md:hidden space-y-4">
                      {clientSummary.map((client) => (
                        <div key={client.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                          <div className="flex justify-between items-center mb-3 border-b border-dashed pb-2"><span className="font-extrabold text-green-800 text-lg">{client.name}</span><span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{client.count}건 등록</span></div>
                          <div className="text-sm text-gray-600 space-y-1 mb-3"><div className="flex justify-between"><span className="font-medium">공급가액:</span><span>{client.supply.toLocaleString()}원</span></div><div className="flex justify-between"><span className="font-medium">부가세:</span><span>{client.vat.toLocaleString()}원</span></div><div className="flex justify-between pt-2 mt-2 border-t"><span className="font-bold">총 합계:</span><span className="font-extrabold text-green-700">{client.total.toLocaleString()}원</span></div></div>
                          <button onClick={() => { setSelectedClientId(client.id); setFilterSearchTerm(client.name); setActiveTab('list'); }} className="w-full bg-green-50 text-green-700 border border-green-200 py-2 rounded-lg text-sm font-bold text-center">해당 매입목록 보기</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* 2. 상세 내역 탭 */}
                {activeTab === 'items' && (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-300">
                            <th className="p-3 w-24 font-bold">등록일자</th><th className="p-3 w-36 font-extrabold text-green-700">매입처명</th><th className="p-3 w-32 font-bold text-gray-500">전표번호</th>
                            <th className="p-3 font-bold">품목명</th><th className="p-3 w-16 text-center font-bold">수량</th><th className="p-3 w-28 text-right font-bold">단가</th><th className="p-3 w-32 text-right font-extrabold text-green-700">매입금액</th>
                            {/* === 핵심 추가: 관리 탭 (전표 보기) === */}
                            <th className="p-3 w-24 text-center font-bold text-gray-800">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailedItems.map((item, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50 transition text-sm">
                              <td className="p-3 font-bold text-gray-600 whitespace-nowrap">{new Date(item.created_at).toLocaleDateString()}</td><td className="p-3 font-bold text-green-800 whitespace-nowrap">{item.client_name}</td>
                              <td className="p-3 font-medium text-gray-400 truncate max-w-[120px]">{item.purchase_no}</td><td className="p-3 font-extrabold text-gray-800 truncate max-w-[200px] lg:max-w-[300px]">{item.item_name}</td>
                              <td className="p-3 text-center font-bold text-indigo-600">{item.qty.toLocaleString()}</td><td className="p-3 text-right text-gray-600">{item.price.toLocaleString()}원</td><td className="p-3 text-right font-bold text-gray-800">{(item.qty * item.price).toLocaleString()}원</td>
                              {/* === 핵심 추가: 전표 보기 버튼 === */}
                              <td className="p-3 text-center whitespace-nowrap">
                                <Link href={`/purchase/${item.purchase_id}`} className="text-blue-600 font-bold px-2 py-1 border border-blue-200 rounded bg-white text-xs hover:bg-blue-50 shadow-sm transition">
                                  전표 보기
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* 모바일 상세 카드 */}
                    <div className="md:hidden space-y-4">
                      {detailedItems.map((item, idx) => (
                        <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                          <div className="flex justify-between items-center mb-2 border-b border-dashed pb-2"><span className="text-sm font-medium text-gray-500">{new Date(item.created_at).toLocaleDateString()}</span><span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded truncate max-w-[120px]">{item.purchase_no}</span></div>
                          <div className="mb-2"><h3 className="font-extrabold text-green-800 text-lg">{item.client_name}</h3><p className="font-extrabold text-gray-900 mt-1">{item.item_name}</p></div>
                          <div className="flex justify-between items-center text-sm text-gray-600 bg-gray-50 p-2 rounded"><div className="flex items-center gap-2"><span className="font-medium text-indigo-600 border border-indigo-200 bg-white px-2 py-0.5 rounded">{item.qty}개</span><span>× {item.price.toLocaleString()}원</span></div><span className="font-extrabold text-gray-800">{(item.qty * item.price).toLocaleString()}원</span></div>
                          {/* === 핵심 추가: 모바일 전표 보기 버튼 === */}
                          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                            <Link href={`/purchase/${item.purchase_id}`} className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition hover:bg-blue-100">
                              전표 보기
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* 3. 목록 탭 */}
                {activeTab === 'list' && (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-200">
                            <th className="p-3 cursor-pointer hover:bg-gray-200 transition select-none font-bold text-gray-700 whitespace-nowrap" onClick={toggleSort}>등록일자 {sortOrder === 'desc' ? '▼' : '▲'}</th>
                            <th className="p-3 font-bold text-gray-700 w-32">전표번호</th><th className="p-3 font-bold text-gray-700">품목명</th><th className="p-3 font-extrabold text-green-700">매입처명</th>
                            <th className="p-3 text-right font-bold text-gray-700 whitespace-nowrap">공급가액</th><th className="p-3 text-right font-bold text-gray-700 whitespace-nowrap">부가세</th>
                            <th className="p-3 text-right font-extrabold text-green-700 whitespace-nowrap">총합계</th><th className="p-3 text-center font-bold text-gray-700 whitespace-nowrap">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchases.map((p) => (
                            <tr key={p.id} className="border-b hover:bg-gray-50 transition text-sm">
                              <td className="p-3 text-gray-600 font-bold whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td><td className="p-3 font-medium text-gray-500 truncate max-w-[100px]">{p.purchase_no}</td>
                              <td className="p-3 font-extrabold text-gray-800 truncate max-w-[200px]" title={getProductName(p.purchase_items)}>{getProductName(p.purchase_items)}</td><td className="p-3 font-extrabold text-green-800 whitespace-nowrap">{p.clients?.name || '삭제된 매입처'}</td>
                              <td className="p-3 text-right font-bold text-gray-700 whitespace-nowrap">{p.supply_amount.toLocaleString()}원</td><td className="p-3 text-right font-bold text-gray-500 whitespace-nowrap">{p.vat_amount.toLocaleString()}원</td>
                              <td className="p-3 text-right font-extrabold text-green-700 whitespace-nowrap">{p.total_amount.toLocaleString()}원</td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <Link href={`/purchase/${p.id}`} className="inline-block text-blue-600 font-bold px-3 py-1.5 border border-blue-200 rounded bg-white text-xs hover:bg-blue-50 transition shadow-sm mr-1">보기</Link>
                                <button onClick={() => handleDelete(p.id)} className="inline-block text-red-500 hover:text-red-700 font-bold px-3 py-1.5 border border-red-200 rounded bg-white text-xs hover:bg-red-50 transition shadow-sm">삭제</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* 모바일 목록 카드 */}
                    <div className="md:hidden space-y-4">
                      {purchases.map((p) => (
                        <div key={p.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm relative">
                          <div className="flex justify-between items-center mb-3 border-b border-dashed pb-2"><span className="text-sm font-medium text-gray-500">{new Date(p.created_at).toLocaleDateString()}</span><span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded truncate max-w-[120px]">{p.purchase_no}</span></div>
                          <div className="mb-4"><h3 className="font-extrabold text-xl text-green-800">{p.clients?.name || '삭제된 매입처'}</h3><p className="text-sm font-medium text-gray-600 mt-1 truncate">품목: {getProductName(p.purchase_items)}</p></div>
                          <div className="flex justify-between items-end">
                            <div className="text-sm text-gray-600 space-y-1"><p><span className="inline-block w-12 font-medium">공급가:</span> {p.supply_amount.toLocaleString()}원</p><p><span className="inline-block w-12 font-medium">부가세:</span> {p.vat_amount.toLocaleString()}원</p></div>
                            <div className="text-right flex flex-col items-end">
                              <p className="font-extrabold text-xl text-green-700 mb-2">{p.total_amount.toLocaleString()}원</p>
                              <div className="flex gap-2 mt-2">
                                <Link href={`/purchase/${p.id}`} className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-sm font-bold transition hover:bg-blue-100">보기</Link>
                                <button onClick={() => handleDelete(p.id)} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold transition hover:bg-red-100">삭제</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}