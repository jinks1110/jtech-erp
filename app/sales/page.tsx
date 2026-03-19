"use client";

import React, { useState, useEffect } from 'react';
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
  invoice_items: { name: string; qty: number; }[];
}

export default function SalesPage() {
  const router = useRouter(); 
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');

  const [quickYear, setQuickYear] = useState(new Date().getFullYear().toString());
  const [quickMonth, setQuickMonth] = useState((new Date().getMonth() + 1).toString());

  const [companyName, setCompanyName] = useState('J-TECH');

  // === 1. 정렬 상태 관리 추가 (기본값: 최신순 desc) ===
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', desc: '', confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700',
    onConfirm: async () => {}
  });

  const closeModal = () => setConfirmModal({ ...confirmModal, isOpen: false });

  useEffect(() => {
    applyQuickFilter(quickYear, quickMonth);
  }, []);

  const applyQuickFilter = (year: string, month: string) => {
    if (!year) return;
    if (year && !month) {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else if (year && month) {
      const paddedMonth = month.padStart(2, '0');
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      setStartDate(`${year}-${paddedMonth}-01`);
      setEndDate(`${year}-${paddedMonth}-${lastDay}`);
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const y = e.target.value;
    setQuickYear(y);
    applyQuickFilter(y, quickMonth);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = e.target.value;
    setQuickMonth(m);
    applyQuickFilter(quickYear, m);
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

      const { data: clientsData } = await supabase.from('clients').select('id, name').eq('company_id', profile.company_id).order('name', { ascending: true });
      if (clientsData) setClients(clientsData);

      // === 2. 핵심 수정: DB 쿼리에서 sortOrder를 직접 사용하도록 변경 ===
      let query = supabase.from('invoices').select(`
          id, invoice_no, created_at, supply_amount, vat_amount, total_amount, client_id,
          clients ( name ), invoice_items ( name, qty )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: sortOrder === 'asc' }); // 정렬 상태 반영

      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00Z`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59Z`);
      if (selectedClientId) query = query.eq('client_id', selectedClientId);

      const { data: invoicesData, error } = await query;
      if (error) throw error;
      
      // === 3. 문제의 sortedData (오름차순 강제 고정 로직) 삭제함 ===
      setInvoices(invoicesData as unknown as Invoice[]);

    } catch (error: any) {
      console.error('불러오기 에러:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // === 4. sortOrder가 바뀔 때도 데이터를 다시 불러오도록 감시 대상 추가 ===
  useEffect(() => { fetchData(); }, [startDate, endDate, selectedClientId, sortOrder]);

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

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
      isOpen: true,
      title: '명세서 복사',
      desc: '이 명세서를 복사하여 새 명세서를 작성하시겠습니까?\n(작성일자는 오늘 날짜로 자동 세팅됩니다.)',
      confirmText: '복사하기',
      confirmColor: 'bg-purple-600 hover:bg-purple-700',
      onConfirm: async () => {
        closeModal();
        try {
          const { data: oldInvoice, error: invError } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
          if (invError) throw invError;
          const { data: oldItems, error: itemsError } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId);
          if (itemsError) throw itemsError;

          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          const generatedInvoiceNo = `INV-${dateStr}-${randomStr}`;

          const { data: newInvoice, error: insertInvError } = await supabase.from('invoices').insert([{
            company_id: oldInvoice.company_id, client_id: oldInvoice.client_id, invoice_no: generatedInvoiceNo,
            supply_amount: oldInvoice.supply_amount, vat_amount: oldInvoice.vat_amount, total_amount: oldInvoice.total_amount
          }]).select().single();
          if (insertInvError) throw insertInvError;

          const itemsToInsert = oldItems.map(item => ({
            invoice_id: newInvoice.id, product_id: item.product_id, name: item.name, spec: item.spec, qty: item.qty, price: item.price
          }));
          const { error: insertItemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
          if (insertItemsError) throw insertItemsError;

          router.push(`/sales/${newInvoice.id}`);
        } catch (error: any) {
          alert('명세서 복사에 실패했습니다.');
        }
      }
    });
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    setConfirmModal({
      isOpen: true,
      title: '명세서 영구 삭제',
      desc: '정말 이 명세서를 삭제하시겠습니까?\n(경고: 관련된 품목 내역도 함께 영구 삭제되며 복구할 수 없습니다.)',
      confirmText: '삭제하기',
      confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        closeModal();
        try {
          await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
          await supabase.from('invoices').delete().eq('id', invoiceId);
          fetchData(); 
        } catch (error: any) {
          alert('명세서 삭제에 실패했습니다.');
        }
      }
    });
  };

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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black print:bg-white print:p-0 relative">
      
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 print:hidden">
          <div className="absolute inset-0 bg-transparent" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border-2 border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
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

      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 print:hidden">
        <div className="bg-white p-4 md:p-6 shadow-lg rounded-lg">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-4 md:mb-6 gap-4">
            <h1 className="text-xl md:text-2xl font-bold">매출 및 명세서 조회</h1>
            <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-2">
              <button onClick={() => window.print()} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 md:py-2 px-6 rounded-lg shadow flex items-center justify-center gap-2 transition">
                <span>🖨️</span> 원장 인쇄 (A4)
              </button>
              <button onClick={exportLedgerToExcel} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 md:py-2 px-6 rounded-lg shadow flex items-center justify-center gap-2 transition">
                <span>📓</span> 원장 엑셀
              </button>
              <button onClick={exportToExcel} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white font-bold py-3 md:py-2 px-4 rounded-lg shadow flex items-center justify-center gap-2 transition">
                <span>📊</span> 기본 엑셀
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 flex flex-col md:flex-row items-start md:items-center gap-4">
            <span className="font-bold text-blue-800 shrink-0">📅 빠른 검색:</span>
            <div className="flex gap-2 w-full md:w-auto">
              <select value={quickYear} onChange={handleYearChange} className="flex-1 md:w-32 border rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white font-medium text-gray-700 shadow-sm">
                {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={quickMonth} onChange={handleMonthChange} className="flex-1 md:w-32 border rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white font-medium text-gray-700 shadow-sm">
                <option value="">전체 월</option>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 bg-gray-50 p-3 md:p-4 rounded-lg border">
            <div>
              <label className="block text-xs md:text-sm font-bold mb-1 text-gray-700">시작일</label>
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setQuickMonth(''); }} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-bold mb-1 text-gray-700">종료일</label>
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setQuickMonth(''); }} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-bold mb-1 text-gray-700">거래처 필터</label>
              <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white">
                <option value="">전체 거래처</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-white p-4 md:p-6 rounded-lg shadow border-l-4 border-blue-500 flex justify-between items-center md:block">
            <p className="text-sm text-gray-500 font-bold mb-1">총 공급가액</p>
            <p className="text-lg md:text-2xl font-bold">{totalSupply.toLocaleString()}원</p>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-lg shadow border-l-4 border-purple-500 flex justify-between items-center md:block">
            <p className="text-sm text-gray-500 font-bold mb-1">총 부가세</p>
            <p className="text-lg md:text-2xl font-bold">{totalVat.toLocaleString()}원</p>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-lg shadow border-l-4 border-green-500 flex justify-between items-center md:block">
            <p className="text-sm text-gray-500 font-bold mb-1">총 합계</p>
            <p className="text-xl md:text-2xl font-extrabold text-green-700">{grandTotal.toLocaleString()}원</p>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 shadow-lg rounded-lg">
          {loading ? (
            <p className="text-center text-gray-500 py-10">데이터를 불러오는 중입니다...</p>
          ) : invoices.length === 0 ? (
            <p className="text-center text-gray-500 py-10">조건에 맞는 매출 내역이 없습니다.</p>
          ) : (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-200">
                    {/* === 정렬 버튼 추가 === */}
                    <th className="p-3 cursor-pointer hover:bg-gray-200 transition select-none" onClick={toggleSort}>
                      작성일자 {sortOrder === 'desc' ? '▼' : '▲'}
                    </th>
                    <th className="p-3">문서번호</th>
                    <th className="p-3 w-48">품목명</th>
                    <th className="p-3">거래처명</th>
                    <th className="p-3 text-right">공급가액</th>
                    <th className="p-3 text-right">부가세</th>
                    <th className="p-3 text-right">총합계</th>
                    <th className="p-3 text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-gray-50 transition text-sm">
                      <td className="p-3 text-gray-600 whitespace-nowrap">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="p-3 font-medium text-gray-900 whitespace-nowrap">{inv.invoice_no}</td>
                      <td className="p-3 font-medium text-gray-700 truncate max-w-[200px]" title={getProductName(inv.invoice_items)}>
                        {getProductName(inv.invoice_items)}
                      </td>
                      <td className="p-3 font-bold text-blue-800 whitespace-nowrap">{inv.clients?.name || '삭제된 거래처'}</td>
                      <td className="p-3 text-right whitespace-nowrap">{inv.supply_amount.toLocaleString()}원</td>
                      <td className="p-3 text-right text-gray-500 whitespace-nowrap">{inv.vat_amount.toLocaleString()}원</td>
                      <td className="p-3 text-right font-bold text-green-700 whitespace-nowrap">{inv.total_amount.toLocaleString()}원</td>
                      <td className="p-3 text-center space-x-1 whitespace-nowrap">
                        <Link href={`/sales/${inv.id}`} className="inline-block text-blue-600 hover:text-blue-800 font-bold px-2 py-1 border border-blue-200 rounded bg-white text-xs hover:bg-blue-50 transition">보기</Link>
                        <button onClick={() => handleCopyInvoiceList(inv.id)} className="inline-block text-purple-600 hover:text-purple-800 font-bold px-2 py-1 border border-purple-200 rounded bg-white text-xs hover:bg-purple-50 transition">복사</button>
                        <button onClick={() => handleDeleteInvoice(inv.id)} className="inline-block text-red-500 hover:text-red-700 font-bold px-2 py-1 border border-red-200 rounded bg-white text-xs hover:bg-red-50 transition">삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="hidden print:block w-full max-w-none text-black print-table-wrapper">
        <h1 className="text-3xl font-extrabold text-center mb-6 tracking-widest underline underline-offset-8 decoration-2">매 출 원 장</h1>
        <div className="flex justify-between items-end mb-4 font-bold text-sm">
          <div>
            <p className="mb-1">조회 기간 : {startDate} ~ {endDate}</p>
            <p>조회 대상 : <span className="text-blue-800">{getFilteredClientName()}</span></p>
          </div>
          <div className="text-right">
            <p>공급자 : {companyName}</p>
          </div>
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
                <td className="border border-black p-2 text-center">{new Date(inv.created_at).toLocaleDateString().slice(2)}</td>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}