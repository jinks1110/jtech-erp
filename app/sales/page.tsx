"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Client { id: string; name: string; }
interface Invoice {
  id: string;
  invoice_no: string;
  created_at: string;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  client_id: string;
  clients: { name: string; };
  invoice_items: { name: string; qty: number; price: number; }[];
}

export default function SalesPage() {
  const router = useRouter(); 
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

  // === 핵심 수정 1: 충돌 방지용 초기화 완료 상태 플래그 추가 ===
  const [isInitialized, setIsInitialized] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', desc: '', confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm: async () => {}
  });

  const closeModal = () => setConfirmModal({ ...confirmModal, isOpen: false });

  const applyQuickFilter = (year: string, month: string, cutoff: 'endOfMonth' | '25th') => {
    if (!year) return;
    if (!month) {
      if (cutoff === 'endOfMonth') {
        setStartDate(`${year}-01-01`); 
        setEndDate(`${year}-12-31`);
      } else {
        setStartDate(`${Number(year) - 1}-12-26`); 
        setEndDate(`${year}-12-25`);
      }
    } else {
      const y = Number(year);
      const m = Number(month);
      if (cutoff === 'endOfMonth') {
        const paddedMonth = String(m).padStart(2, '0');
        const lastDay = new Date(y, m, 0).getDate();
        setStartDate(`${year}-${paddedMonth}-01`); 
        setEndDate(`${year}-${paddedMonth}-${lastDay}`);
      } else {
        let prevYear = y;
        let prevMonth = m - 1;
        if (prevMonth === 0) {
          prevYear = y - 1;
          prevMonth = 12;
        }
        const paddedPrevMonth = String(prevMonth).padStart(2, '0');
        const paddedCurrentMonth = String(m).padStart(2, '0');
        setStartDate(`${prevYear}-${paddedPrevMonth}-26`);
        setEndDate(`${year}-${paddedCurrentMonth}-25`);
      }
    }
  };

  // === 핵심 수정 2: 로직 충돌을 막기 위해 모든 초기화 과정을 하나의 useEffect로 완벽하게 통합 ===
  useEffect(() => {
    const saved = sessionStorage.getItem('jtech_sales_filters');
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
      } catch (e) {
        applyQuickFilter(quickYear, quickMonth, cutoffType);
      }
    } else {
      // 저장된 값이 없으면 현재 년/월 기본값으로 필터 적용
      applyQuickFilter(quickYear, quickMonth, cutoffType);
    }
    // 설정 완료 플래그 켜기
    setIsInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === 핵심 수정 3: 초기화가 완전히 끝난(isInitialized === true) 후에만 세션 스토리지 덮어쓰기 허용 ===
  useEffect(() => {
    if (isInitialized) {
      sessionStorage.setItem('jtech_sales_filters', JSON.stringify({
        activeTab, startDate, endDate, selectedClientId, filterSearchTerm, quickYear, quickMonth, cutoffType, sortOrder
      }));
    }
  }, [isInitialized, activeTab, startDate, endDate, selectedClientId, filterSearchTerm, quickYear, quickMonth, cutoffType, sortOrder]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterWrapperRef.current && !filterWrapperRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const y = e.target.value; setQuickYear(y); applyQuickFilter(y, quickMonth, cutoffType);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = e.target.value; setQuickMonth(m); applyQuickFilter(quickYear, m, cutoffType);
  };

  const handleCutoffChange = (type: 'endOfMonth' | '25th') => {
    setCutoffType(type);
    applyQuickFilter(quickYear, quickMonth, type);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile) throw new Error('회사 정보가 없습니다.');

      const { data: compData } = await supabase.from('companies').select('name').eq('id', profile.company_id).single();
      if (compData && compData.name) setCompanyName(compData.name);

      const { data: clientsData } = await supabase.from('clients')
        .select('id, name').eq('company_id', profile.company_id).eq('is_active', true).order('name', { ascending: true });
      if (clientsData) setClients(clientsData);

      let query = supabase.from('invoices').select(`
          id, invoice_no, created_at, supply_amount, vat_amount, total_amount, client_id,
          clients ( name ), invoice_items ( name, qty, price )
        `).eq('company_id', profile.company_id).order('created_at', { ascending: sortOrder === 'asc' });

      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00Z`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59Z`);
      if (selectedClientId) query = query.eq('client_id', selectedClientId);

      const { data: invoicesData, error } = await query;
      if (error) throw error;
      
      setInvoices(invoicesData as unknown as Invoice[]);

    } catch (error: any) {
      console.error('불러오기 에러:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (startDate) { fetchData(); }
  }, [startDate, endDate, selectedClientId, sortOrder]);

  const toggleSort = () => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');

  const getProductName = (items: { name: string }[]) => {
    if (!items || items.length === 0) return '품목 없음';
    if (items.length === 1) return items[0].name;
    return `${items[0].name} 외 ${items.length - 1}건`;
  };

  const getFullItemsDetails = (items: { name: string, qty: number }[]) => {
    return items?.map(item => `${item.name}(${item.qty})`).join(', ') || '품목 없음';
  };

  const exportToExcel = () => {
    if (invoices.length === 0) return alert('다운로드할 데이터가 없습니다.');
    const excelData = invoices.map((inv, index) => ({
      'No': index + 1, '문서번호': inv.invoice_no, '작성일자': new Date(inv.created_at).toLocaleDateString(),
      '거래처명': inv.clients?.name || '알 수 없음', '품목요약': getProductName(inv.invoice_items),
      '공급가액': inv.supply_amount, '부가세': inv.vat_amount, '총합계': inv.total_amount,
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "기본매출내역");
    XLSX.writeFile(workbook, `JTECH_매출요약_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportLedgerToExcel = () => {
    if (invoices.length === 0) return alert('다운로드할 데이터가 없습니다.');
    const ledgerData = invoices.map((inv) => ({
      '일자': new Date(inv.created_at).toLocaleDateString(), '거래처명': inv.clients?.name || '알 수 없음',
      '품목 상세내역 (전체)': getFullItemsDetails(inv.invoice_items), '공급가액': inv.supply_amount,
      '세액(VAT)': inv.vat_amount, '합계금액': inv.total_amount, '비고': ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(ledgerData);
    worksheet['!cols'] = [{ wpx: 100 }, { wpx: 150 }, { wpx: 350 }, { wpx: 100 }, { wpx: 100 }, { wpx: 120 }, { wpx: 100 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, quickMonth ? `${quickMonth}월 매출원장` : '매출원장');
    XLSX.writeFile(workbook, `JTECH_매출원장_${quickYear}년${quickMonth}월_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleCopyInvoiceList = (invoiceId: string) => {
    setConfirmModal({
      isOpen: true, title: '명세서 복사', desc: '이 명세서를 복사하여 새 명세서를 작성하시겠습니까?\n(작성일자는 오늘 날짜로 자동 세팅됩니다.)',
      confirmText: '복사하기', confirmColor: 'bg-purple-600 hover:bg-purple-700',
      onConfirm: async () => {
        closeModal();
        try {
          const { data: oldInvoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
          const { data: oldItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId);
          
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          const generatedInvoiceNo = `INV-${dateStr}-${randomStr}`;

          const { data: newInvoice } = await supabase.from('invoices').insert([{
            company_id: oldInvoice.company_id, client_id: oldInvoice.client_id, invoice_no: generatedInvoiceNo,
            supply_amount: oldInvoice.supply_amount, vat_amount: oldInvoice.vat_amount, total_amount: oldInvoice.total_amount
          }]).select().single();

          const itemsToInsert = oldItems!.map(item => ({
            invoice_id: newInvoice.id, product_id: item.product_id, name: item.name, spec: item.spec, qty: item.qty, price: item.price
          }));
          await supabase.from('invoice_items').insert(itemsToInsert);
          router.push(`/sales/${newInvoice.id}`); 
        } catch (error: any) { alert('명세서 복사에 실패했습니다.'); }
      }
    });
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    setConfirmModal({
      isOpen: true, title: '명세서 영구 삭제', desc: '정말 이 명세서를 삭제하시겠습니까?\n(경고: 관련된 품목 내역도 함께 영구 삭제되며 복구할 수 없습니다.)',
      confirmText: '삭제하기', confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        closeModal();
        try {
          await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
          await supabase.from('invoices').delete().eq('id', invoiceId);
          fetchData(); 
        } catch (error: any) { alert('명세서 삭제에 실패했습니다.'); }
      }
    });
  };

  const clientSummary = useMemo(() => {
    const summary: Record<string, { id: string, name: string, supply: number, vat: number, total: number, count: number }> = {};
    invoices.forEach(inv => {
      const cName = inv.clients?.name || '삭제된 거래처';
      if (!summary[cName]) {
        summary[cName] = { id: inv.client_id, name: cName, supply: 0, vat: 0, total: 0, count: 0 };
      }
      summary[cName].supply += inv.supply_amount;
      summary[cName].vat += inv.vat_amount;
      summary[cName].total += inv.total_amount;
      summary[cName].count += 1;
    });
    return Object.values(summary).sort((a, b) => b.total - a.total);
  }, [invoices]);

  const detailedItems = useMemo(() => {
    const itemsList: any[] = [];
    invoices.forEach(inv => {
      inv.invoice_items.forEach(item => {
        itemsList.push({
          invoice_id: inv.id,
          created_at: inv.created_at,
          invoice_no: inv.invoice_no,
          client_name: inv.clients?.name || '삭제된 거래처',
          item_name: item.name,
          qty: item.qty,
          price: item.price || 0,
        });
      });
    });
    return itemsList;
  }, [invoices]);

  const totalSupply = invoices.reduce((sum, inv) => sum + (inv.supply_amount || 0), 0);
  const totalVat = invoices.reduce((sum, inv) => sum + (inv.vat_amount || 0), 0);
  const grandTotal = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const currentYearNum = new Date().getFullYear();
  const yearOptions = Array.from({length: 5}, (_, i) => currentYearNum - 2 + i); 

  const getFilteredClientName = () => {
    if (!selectedClientId) return '전체 거래처';
    const client = clients.find(c => c.id === selectedClientId);
    return client ? client.name : '전체 거래처';
  };

  const filteredSearchClients = clients.filter(c => c.name.toLowerCase().includes(filterSearchTerm.toLowerCase()));

  const handleClientClick = (clientId: string, clientName: string) => {
    setSelectedClientId(clientId);
    setFilterSearchTerm(clientName);
    setActiveTab('list');
  };

  const handleTabChange = (tab: 'list' | 'summary' | 'items') => {
    if (tab === 'summary' || tab === 'items') {
      setSelectedClientId('');
      setFilterSearchTerm('');
    }
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 pt-16 lg:p-4 lg:pt-8 text-black print:bg-white print:p-0 relative">
      
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 print:hidden">
          <div className="absolute inset-0 bg-gray-900/10 backdrop-blur-[2px]" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 whitespace-pre-line text-sm leading-relaxed">{confirmModal.desc}</p>
            <div className="flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">취소</button>
              <button onClick={confirmModal.onConfirm} className={`px-4 py-2 rounded-lg font-bold text-white transition shadow-md ${confirmModal.confirmColor}`}>
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page { size: A4 landscape; margin: 15mm; } 
            body { background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-table-wrapper { page-break-inside: avoid; }
          }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }
        `
      }} />

      <div className="max-w-[95%] xl:max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 print:hidden">
        
        <div className="w-full lg:w-1/4 space-y-4 shrink-0">
          <div className="bg-white p-5 md:p-6 shadow-lg rounded-lg border-t-4 border-blue-600 lg:sticky lg:top-6">
            <div className="mb-4 border-b pb-4">
              <h1 className="text-xl md:text-2xl font-extrabold">매출 및 명세서 조회</h1>
              <p className="text-gray-500 text-sm mt-1 font-bold">기간 및 거래처별 데이터 분석</p>
            </div>
            
            <div className="flex flex-col gap-2 mb-6">
              <button onClick={() => handleTabChange('summary')} className={`text-left p-3 rounded-lg font-bold transition flex items-center gap-2 ${activeTab === 'summary' ? 'bg-blue-100 text-blue-800 border-l-4 border-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                <span>🏢</span> 거래처별 집계
              </button>
              <button onClick={() => handleTabChange('list')} className={`text-left p-3 rounded-lg font-bold transition flex items-center gap-2 ${activeTab === 'list' ? 'bg-blue-100 text-blue-800 border-l-4 border-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                <span>📄</span> 명세서 목록
              </button>
              <button onClick={() => handleTabChange('items')} className={`text-left p-3 rounded-lg font-bold transition flex items-center gap-2 ${activeTab === 'items' ? 'bg-blue-100 text-blue-800 border-l-4 border-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                <span>📦</span> 품목별 상세 내역
              </button>
            </div>

            <div className="h-px bg-gray-200 my-4"></div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">마감 기준 & 년월 선택</label>
                <div className="flex bg-gray-100 rounded-lg p-1 mb-2">
                  <button onClick={() => handleCutoffChange('endOfMonth')} className={`flex-1 py-1.5 text-xs font-bold rounded ${cutoffType === 'endOfMonth' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>말일 마감</button>
                  <button onClick={() => handleCutoffChange('25th')} className={`flex-1 py-1.5 text-xs font-bold rounded ${cutoffType === '25th' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>25일 마감</button>
                </div>
                <div className="flex gap-2">
                  <select value={quickYear} onChange={handleYearChange} className="flex-1 border rounded-lg p-2 text-sm outline-none focus:border-blue-500 font-bold bg-white text-gray-700">
                    {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
                  </select>
                  {/* === 핵심 수정 4: value에 명시적으로 .toString()을 부여하여 데이터와 UI를 완벽 동기화 === */}
                  <select value={quickMonth} onChange={handleMonthChange} className="flex-1 border rounded-lg p-2 text-sm outline-none focus:border-blue-500 font-bold bg-white text-gray-700">
                    <option value="">전체 월</option>
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m.toString()}>{m}월</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">시작일</label>
                  {/* === 핵심 수정 5: 날짜를 수동으로 바꿀 때도 UI가 꼬이지 않도록 quickMonth를 빈 값으로 리셋 === */}
                  <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setQuickMonth(''); }} className="w-full border rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500" />
                </div>
                <div className="w-1/2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">종료일</label>
                  <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setQuickMonth(''); }} className="w-full border rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="relative" ref={filterWrapperRef}>
                <label className="block text-sm font-bold text-gray-700 mb-1">거래처 필터</label>
                <input
                  type="text"
                  className="w-full border-2 border-blue-200 rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white placeholder-gray-400 font-bold"
                  placeholder="전체 거래처 (클릭하여 검색)"
                  value={filterSearchTerm}
                  onChange={(e) => {
                    setFilterSearchTerm(e.target.value);
                    setShowFilterDropdown(true);
                    if (e.target.value === '') setSelectedClientId(''); 
                  }}
                  onClick={() => setShowFilterDropdown(true)}
                />
                {showFilterDropdown && filteredSearchClients.length > 0 && (
                  <ul className="absolute z-20 w-full mt-1 bg-white border-2 border-blue-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    <li 
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer font-bold border-b text-gray-600 flex items-center justify-between"
                      onClick={() => { setFilterSearchTerm(''); setSelectedClientId(''); setShowFilterDropdown(false); }}
                    >
                      <span>전체 보기 (초기화)</span>
                      <span>↺</span>
                    </li>
                    {filteredSearchClients.map(client => (
                      <li
                        key={client.id}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer font-extrabold text-blue-900 border-b border-gray-100 last:border-b-0"
                        onClick={() => { setFilterSearchTerm(client.name); setSelectedClientId(client.id); setShowFilterDropdown(false); }}
                      >
                        {client.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="h-px bg-gray-200 my-5"></div>
            
            <div className="flex flex-col gap-2">
              <button onClick={() => window.print()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow flex items-center justify-center gap-2 transition text-sm">
                <span>🖨️</span> 원장 인쇄 (A4)
              </button>
              <button onClick={exportLedgerToExcel} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg shadow flex items-center justify-center gap-2 transition text-sm">
                <span>📓</span> 원장 엑셀 내보내기
              </button>
              <button onClick={exportToExcel} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg shadow flex items-center justify-center gap-2 transition text-sm">
                <span>📊</span> 기본 목록 엑셀 내보내기
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-3/4 flex flex-col gap-4 sm:gap-6 overflow-hidden">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-blue-500 flex flex-col justify-center">
              <p className="text-xs font-extrabold text-gray-500 mb-1">총 공급가액</p>
              <p className="text-xl sm:text-2xl font-extrabold text-gray-900">{totalSupply.toLocaleString()}원</p>
            </div>
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-purple-500 flex flex-col justify-center">
              <p className="text-xs font-extrabold text-gray-500 mb-1">총 부가세</p>
              <p className="text-xl sm:text-2xl font-extrabold text-gray-900">{totalVat.toLocaleString()}원</p>
            </div>
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-green-500 flex flex-col justify-center bg-green-50/30">
              <p className="text-sm font-extrabold text-green-700 mb-1">총 합계금액</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-green-700">{grandTotal.toLocaleString()}<span className="text-sm sm:text-lg ml-1">원</span></p>
            </div>
          </div>

          <div className="bg-white p-4 md:p-6 shadow-lg rounded-xl flex-grow min-h-[500px]">
            {loading ? (
              <div className="h-full flex items-center justify-center"><p className="font-bold text-gray-500">데이터를 불러오는 중입니다...</p></div>
            ) : invoices.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-10 mt-4">
                <span className="text-4xl mb-3 opacity-50">📭</span>
                <p className="text-gray-500 font-bold">해당 조건에 맞는 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="animate-fade-in-up">
                
                {/* 1. 거래처별 집계 탭 */}
                {activeTab === 'summary' && (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <p className="text-sm text-gray-500 mb-3 font-bold">* [목록 보기]를 클릭하면 해당 업체의 명세서 목록만 필터링되어 나타납니다.</p>
                      <table className="w-full border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-300">
                            <th className="p-3 w-16 text-center font-bold">No</th>
                            <th className="p-3 font-extrabold text-blue-700">거래처명</th>
                            <th className="p-3 w-24 text-center font-bold">발행 건수</th>
                            <th className="p-3 w-32 text-right font-bold">공급가액</th>
                            <th className="p-3 w-32 text-right font-bold">부가세</th>
                            <th className="p-3 w-40 text-right font-extrabold text-green-700">총 합계</th>
                            <th className="p-3 text-center w-28 whitespace-nowrap">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientSummary.map((client, idx) => (
                            <tr key={client.id} className="border-b hover:bg-blue-50 transition text-sm">
                              <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                              <td className="p-3 font-extrabold text-gray-900">{client.name}</td>
                              <td className="p-3 text-center font-bold text-gray-600">{client.count}건</td>
                              <td className="p-3 text-right font-bold text-gray-700">{client.supply.toLocaleString()}원</td>
                              <td className="p-3 text-right font-bold text-gray-500">{client.vat.toLocaleString()}원</td>
                              <td className="p-3 text-right font-extrabold text-blue-700 bg-blue-50/30">{client.total.toLocaleString()}원</td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <button onClick={() => handleClientClick(client.id, client.name)} className="bg-white text-blue-600 border border-blue-200 px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-50 transition shadow-sm whitespace-nowrap">목록 보기</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden space-y-4">
                      {clientSummary.map((client, idx) => (
                        <div key={client.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                          <div className="flex justify-between items-center mb-3 border-b border-dashed pb-2">
                            <span className="font-extrabold text-blue-800 text-lg">{client.name}</span>
                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{client.count}건 발행</span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1 mb-3">
                            <div className="flex justify-between"><span className="font-medium">공급가액:</span><span>{client.supply.toLocaleString()}원</span></div>
                            <div className="flex justify-between"><span className="font-medium">부가세:</span><span>{client.vat.toLocaleString()}원</span></div>
                            <div className="flex justify-between pt-2 mt-2 border-t"><span className="font-bold">총 합계:</span><span className="font-extrabold text-blue-700">{client.total.toLocaleString()}원</span></div>
                          </div>
                          <button onClick={() => handleClientClick(client.id, client.name)} className="w-full bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded-lg text-sm font-bold text-center">목록 보기</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* 2. 품목별 상세 내역 탭 */}
                {activeTab === 'items' && (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-300">
                            <th className="p-3 w-24 font-bold">작성일자</th>
                            <th className="p-3 w-36 font-extrabold text-blue-700">거래처명</th>
                            <th className="p-3 w-32 font-bold text-gray-500">문서번호</th>
                            <th className="p-3 font-bold">품목명</th>
                            <th className="p-3 w-16 text-center font-bold">수량</th>
                            <th className="p-3 w-28 text-right font-bold">단가</th>
                            <th className="p-3 w-32 text-right font-extrabold text-green-700">공급가액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailedItems.map((item, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50 transition text-sm">
                              <td className="p-3 font-bold text-gray-600 whitespace-nowrap">{new Date(item.created_at).toLocaleDateString()}</td>
                              <td className="p-3 font-bold text-blue-800 whitespace-nowrap">{item.client_name}</td>
                              <td className="p-3 font-medium text-gray-400 truncate max-w-[120px]" title={item.invoice_no}>{item.invoice_no}</td>
                              <td className="p-3 font-extrabold text-gray-800 truncate max-w-[200px] lg:max-w-[300px]" title={item.item_name}>{item.item_name}</td>
                              <td className="p-3 text-center font-bold text-indigo-600">{item.qty.toLocaleString()}</td>
                              <td className="p-3 text-right text-gray-600">{item.price.toLocaleString()}원</td>
                              <td className="p-3 text-right font-bold text-gray-800">{(item.qty * item.price).toLocaleString()}원</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden space-y-4">
                      {detailedItems.map((item, idx) => (
                        <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                          <div className="flex justify-between items-center mb-2 border-b border-dashed pb-2">
                            <span className="text-sm font-medium text-gray-500">{new Date(item.created_at).toLocaleDateString()}</span>
                            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded truncate max-w-[120px]">{item.invoice_no}</span>
                          </div>
                          <div className="mb-2">
                            <h3 className="font-extrabold text-blue-800 text-lg">{item.client_name}</h3>
                            <p className="font-extrabold text-gray-900 mt-1">{item.item_name}</p>
                          </div>
                          <div className="flex justify-between items-center text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-2"><span className="font-medium text-indigo-600 border border-indigo-200 bg-white px-2 py-0.5 rounded">{item.qty}개</span><span>× {item.price.toLocaleString()}원</span></div>
                            <span className="font-extrabold text-gray-800">{(item.qty * item.price).toLocaleString()}원</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* 3. 명세서 목록 탭 */}
                {activeTab === 'list' && (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-200">
                            <th className="p-3 cursor-pointer hover:bg-gray-200 transition select-none font-bold text-gray-700 whitespace-nowrap" onClick={toggleSort}>
                              작성일자 {sortOrder === 'desc' ? '▼' : '▲'}
                            </th>
                            <th className="p-3 font-bold text-gray-700 w-32">문서번호</th>
                            <th className="p-3 font-bold text-gray-700">품목명</th>
                            <th className="p-3 font-extrabold text-blue-700">거래처명</th>
                            <th className="p-3 text-right font-bold text-gray-700 whitespace-nowrap">공급가액</th>
                            <th className="p-3 text-right font-bold text-gray-700 whitespace-nowrap">부가세</th>
                            <th className="p-3 text-right font-extrabold text-green-700 whitespace-nowrap">총합계</th>
                            <th className="p-3 text-center font-bold text-gray-700 whitespace-nowrap">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((inv) => (
                            <tr key={inv.id} className="border-b hover:bg-gray-50 transition text-sm">
                              <td className="p-3 text-gray-600 font-bold whitespace-nowrap">{new Date(inv.created_at).toLocaleDateString()}</td>
                              <td className="p-3 font-medium text-gray-500 truncate max-w-[100px] sm:max-w-[120px]" title={inv.invoice_no}>{inv.invoice_no}</td>
                              <td className="p-3 font-extrabold text-gray-800 truncate max-w-[200px] lg:max-w-[350px]" title={getProductName(inv.invoice_items)}>{getProductName(inv.invoice_items)}</td>
                              <td className="p-3 font-extrabold text-blue-800 whitespace-nowrap">{inv.clients?.name || '삭제된 거래처'}</td>
                              <td className="p-3 text-right font-bold text-gray-700 whitespace-nowrap">{inv.supply_amount.toLocaleString()}원</td>
                              <td className="p-3 text-right font-bold text-gray-500 whitespace-nowrap">{inv.vat_amount.toLocaleString()}원</td>
                              <td className="p-3 text-right font-extrabold text-green-700 whitespace-nowrap">{inv.total_amount.toLocaleString()}원</td>
                              <td className="p-3 text-center space-x-1 whitespace-nowrap">
                                <Link href={`/sales/${inv.id}`} className="inline-block text-blue-600 hover:text-blue-800 font-bold px-2 py-1 border border-blue-200 rounded bg-white text-xs hover:bg-blue-50 transition shadow-sm">보기</Link>
                                <button onClick={() => handleCopyInvoiceList(inv.id)} className="inline-block text-purple-600 hover:text-purple-800 font-bold px-2 py-1 border border-purple-200 rounded bg-white text-xs hover:bg-purple-50 transition shadow-sm">복사</button>
                                <button onClick={() => handleDeleteInvoice(inv.id)} className="inline-block text-red-500 hover:text-red-700 font-bold px-2 py-1 border border-red-200 rounded bg-white text-xs hover:bg-red-50 transition shadow-sm">삭제</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden space-y-4">
                      {invoices.map((inv) => (
                        <div key={inv.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm relative">
                          <div className="flex justify-between items-center mb-3 border-b border-dashed pb-2">
                            <span className="text-sm font-medium text-gray-500">{new Date(inv.created_at).toLocaleDateString()}</span>
                            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded truncate max-w-[120px]">{inv.invoice_no}</span>
                          </div>
                          <div className="mb-4">
                            <h3 className="font-extrabold text-xl text-blue-800">{inv.clients?.name || '삭제된 거래처'}</h3>
                            <p className="text-sm font-medium text-gray-600 mt-1 truncate">품목: {getProductName(inv.invoice_items)}</p>
                          </div>
                          <div className="flex justify-between items-end">
                            <div className="text-sm text-gray-600 space-y-1">
                              <p><span className="inline-block w-12 font-medium">공급가:</span> {inv.supply_amount.toLocaleString()}원</p>
                              <p><span className="inline-block w-12 font-medium">부가세:</span> {inv.vat_amount.toLocaleString()}원</p>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <p className="font-extrabold text-xl text-green-700 mb-2">{inv.total_amount.toLocaleString()}원</p>
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => handleDeleteInvoice(inv.id)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold transition hover:bg-red-100">삭제</button>
                                <button onClick={() => handleCopyInvoiceList(inv.id)} className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-2 rounded-lg text-sm font-bold transition hover:bg-purple-100">복사</button>
                                <Link href={`/sales/${inv.id}`} className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg text-sm font-bold text-center transition hover:bg-blue-100">보기</Link>
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

      <div className="hidden print:block w-full max-w-none text-black print-table-wrapper">
        <h1 className="text-3xl font-extrabold text-center mb-6 tracking-widest underline underline-offset-8 decoration-2">매 출 원 장</h1>
        
        <div className="flex justify-between items-end mb-4 font-bold text-sm">
          <div><p className="mb-1">조회 기간 : {startDate} ~ {endDate}</p><p>조회 대상 : <span className="text-blue-800">{getFilteredClientName()}</span></p></div>
          <div className="text-right"><p>공급자 : {companyName}</p></div>
        </div>

        <table className="w-full border-collapse border border-black text-xs mb-2">
          <thead>
            <tr className="bg-gray-100 text-center font-bold">
              <th className="border border-black p-2 w-16">일자</th>
              <th className="border border-black p-2 w-28">거래처명</th>
              <th className="border border-black p-2">품목 상세내역 (수량)</th>
              <th className="border border-black p-2 w-20">공급가액</th>
              <th className="border border-black p-2 w-16">세액</th>
              <th className="border border-black p-2 w-24">합계금액</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="border border-black p-2 text-center align-middle">{new Date(inv.created_at).toLocaleDateString().slice(2)}</td>
                <td className="border border-black p-2 text-center font-bold">{inv.clients?.name || '-'}</td>
                <td className="border border-black p-2 leading-relaxed">{getFullItemsDetails(inv.invoice_items)}</td>
                <td className="border border-black p-2 text-right">{inv.supply_amount.toLocaleString()}</td>
                <td className="border border-black p-2 text-right text-gray-600">{inv.vat_amount.toLocaleString()}</td>
                <td className="border border-black p-2 text-right font-bold text-gray-900">{inv.total_amount.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-gray-200 font-extrabold text-sm border-t-2 border-black">
              <td colSpan={3} className="border border-black p-3 text-center tracking-widest">총 합 계</td>
              <td className="border border-black p-3 text-right">{totalSupply.toLocaleString()}</td>
              <td className="border border-black p-3 text-right">{totalVat.toLocaleString()}</td>
              <td className="border border-black p-3 text-right">{grandTotal.toLocaleString()}</td>
            </tr>
            <tr className="border-none">
              <td colSpan={6} className="border-none pt-6 pb-2 text-center text-sm text-gray-700 font-bold tracking-wide">
                - 위 내용과 같이 매출 내역을 청구(보고)합니다 -
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}