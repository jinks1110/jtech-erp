"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Quotation {
  id: string; quotation_no: string; created_at: string; 
  supply_amount: number; vat_amount: number; total_amount: number; 
  client_id: string; clients: { name: string; }; quotation_items: { name: string; }[];
}

export default function QuotationListPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [startDate, setStartDate] = useState(''); 
  const [endDate, setEndDate] = useState(''); 
  const [selectedClientId, setSelectedClientId] = useState('');

  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterWrapperRef = useRef<HTMLDivElement>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', desc: '', confirmText: '확인', confirmColor: 'bg-yellow-500 hover:bg-yellow-600', onConfirm: async () => {} });
  const closeModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const applyDefaultDates = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(currentYear, today.getMonth() + 1, 0).getDate();
    setStartDate(`${currentYear}-${currentMonth}-01`);
    setEndDate(`${currentYear}-${currentMonth}-${lastDay}`);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('jtech_quote_filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.startDate) setStartDate(parsed.startDate);
        if (parsed.endDate) setEndDate(parsed.endDate);
        if (parsed.selectedClientId !== undefined) setSelectedClientId(parsed.selectedClientId);
        if (parsed.filterSearchTerm !== undefined) setFilterSearchTerm(parsed.filterSearchTerm);
      } catch (e) {
        applyDefaultDates();
      }
    } else {
      applyDefaultDates();
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      sessionStorage.setItem('jtech_quote_filters', JSON.stringify({ startDate, endDate, selectedClientId, filterSearchTerm }));
    }
  }, [isInitialized, startDate, endDate, selectedClientId, filterSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (filterWrapperRef.current && !filterWrapperRef.current.contains(event.target as Node)) setShowFilterDropdown(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();

      const { data: clientsData } = await supabase.from('clients').select('id, name').eq('company_id', profile!.company_id).order('name', { ascending: true });
      if (clientsData) setClients(clientsData);

      let query = supabase.from('quotations').select(`id, quotation_no, created_at, supply_amount, vat_amount, total_amount, client_id, clients ( name ), quotation_items ( name )`).eq('company_id', profile!.company_id).order('created_at', { ascending: false });
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00Z`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59Z`);
      if (selectedClientId) query = query.eq('client_id', selectedClientId);

      const { data, error } = await query;
      if (error) throw error;
      setQuotations(data as unknown as Quotation[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (startDate) fetchData(); }, [startDate, endDate, selectedClientId]);

  const getProductName = (items: { name: string }[]) => {
    if (!items || items.length === 0) return '품목 없음';
    if (items.length === 1) return items[0].name;
    return `${items[0].name} 외 ${items.length - 1}건`;
  };

  const handleCopyQuotationList = (quotationId: string) => {
    setConfirmModal({
      isOpen: true, title: '견적서 복사', desc: '이 견적서를 복사하여 새 견적서를 작성하시겠습니까?\n(견적일자는 오늘 날짜로 자동 세팅됩니다.)',
      confirmText: '복사하기', confirmColor: 'bg-purple-600 hover:bg-purple-700',
      onConfirm: async () => {
        closeModal();
        try {
          const { data: oldQuote } = await supabase.from('quotations').select('*').eq('id', quotationId).single();
          const { data: oldItems } = await supabase.from('quotation_items').select('*').eq('quotation_id', quotationId);

          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          const generatedQuotationNo = `EST-${dateStr}-${randomStr}`;

          const { data: newQuote } = await supabase.from('quotations').insert([{
            company_id: oldQuote.company_id, client_id: oldQuote.client_id, quotation_no: generatedQuotationNo,
            supply_amount: oldQuote.supply_amount, vat_amount: oldQuote.vat_amount, total_amount: oldQuote.total_amount
          }]).select().single();

          const itemsToInsert = oldItems!.map(item => ({
            quotation_id: newQuote.id, product_id: item.product_id, name: item.name, spec: item.spec, qty: item.qty, price: item.price
          }));
          await supabase.from('quotation_items').insert(itemsToInsert);

          router.push(`/quotation/${newQuote.id}`);
        } catch (error: any) { alert('견적서 복사에 실패했습니다.'); }
      }
    });
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true, title: '견적서 삭제', desc: '정말 이 견적서를 삭제하시겠습니까?',
      confirmText: '삭제하기', confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        closeModal();
        try {
          await supabase.from('quotation_items').delete().eq('quotation_id', id);
          await supabase.from('quotations').delete().eq('id', id);
          fetchData();
        } catch (error) { alert('삭제 실패'); }
      }
    });
  };

  const filteredSearchClients = clients.filter(c => c.name.toLowerCase().includes(filterSearchTerm.toLowerCase()));

  const totalSupply = quotations.reduce((sum, q) => sum + (q.supply_amount || 0), 0);
  const totalVat = quotations.reduce((sum, q) => sum + (q.vat_amount || 0), 0);
  const grandTotal = quotations.reduce((sum, q) => sum + (q.total_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-2 pt-16 lg:p-4 lg:pt-8 text-black relative">
      
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4">
          <div className="absolute inset-0 bg-gray-900/10 backdrop-blur-[2px]" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 whitespace-pre-line text-sm leading-relaxed">{confirmModal.desc}</p>
            <div className="flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">취소</button>
              <button onClick={confirmModal.onConfirm} className={`px-4 py-2 rounded-lg font-bold text-white transition shadow-md ${confirmModal.confirmColor}`}>{confirmModal.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }` }} />

      <div className="max-w-[95%] xl:max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* 좌측 패널: 필터 영역 */}
        <div className="w-full lg:w-1/4 space-y-4 shrink-0">
          <div className="bg-white p-5 md:p-6 shadow-lg rounded-lg border-t-4 border-yellow-500 lg:sticky lg:top-6">
            <div className="mb-4 border-b pb-4">
              <h1 className="text-xl md:text-2xl font-extrabold">견적내역 조회</h1>
              <p className="text-gray-500 text-sm mt-1 font-bold">견적 기간 및 거래처 검색</p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="w-1/2"><label className="block text-xs font-bold text-gray-500 mb-1">시작일</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-lg p-2 text-xs font-bold outline-none focus:border-yellow-500" /></div>
                <div className="w-1/2"><label className="block text-xs font-bold text-gray-500 mb-1">종료일</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-lg p-2 text-xs font-bold outline-none focus:border-yellow-500" /></div>
              </div>

              <div className="relative" ref={filterWrapperRef}>
                <label className="block text-sm font-bold text-gray-700 mb-1">거래처 필터</label>
                <input type="text" className="w-full border-2 border-yellow-200 rounded-lg p-2.5 outline-none focus:border-yellow-500 bg-white placeholder-gray-400 font-bold" placeholder="전체 거래처 (클릭하여 검색)" value={filterSearchTerm} onChange={(e) => { setFilterSearchTerm(e.target.value); setShowFilterDropdown(true); if (e.target.value === '') setSelectedClientId(''); }} onClick={() => setShowFilterDropdown(true)} />
                {showFilterDropdown && filteredSearchClients.length > 0 && (
                  <ul className="absolute z-20 w-full mt-1 bg-white border-2 border-yellow-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    <li className="px-4 py-3 hover:bg-yellow-50 cursor-pointer font-bold border-b text-gray-600 flex items-center justify-between" onClick={() => { setFilterSearchTerm(''); setSelectedClientId(''); setShowFilterDropdown(false); }}><span>전체 보기 (초기화)</span><span>↺</span></li>
                    {filteredSearchClients.map(client => (
                      <li key={client.id} className="px-4 py-3 hover:bg-yellow-50 cursor-pointer font-extrabold text-yellow-900 border-b border-gray-100 last:border-b-0" onClick={() => { setFilterSearchTerm(client.name); setSelectedClientId(client.id); setShowFilterDropdown(false); }}>{client.name}</li>
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
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-blue-500 flex flex-col justify-center"><p className="text-xs font-extrabold text-gray-500 mb-1">총 견적 공급가액</p><p className="text-xl sm:text-2xl font-extrabold text-gray-900">{totalSupply.toLocaleString()}원</p></div>
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-purple-500 flex flex-col justify-center"><p className="text-xs font-extrabold text-gray-500 mb-1">총 견적 부가세</p><p className="text-xl sm:text-2xl font-extrabold text-gray-900">{totalVat.toLocaleString()}원</p></div>
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-yellow-500 flex flex-col justify-center bg-yellow-50/30"><p className="text-sm font-extrabold text-yellow-700 mb-1">총 견적 합계금액</p><p className="text-2xl sm:text-3xl font-extrabold text-yellow-700">{grandTotal.toLocaleString()}<span className="text-sm sm:text-lg ml-1">원</span></p></div>
          </div>

          <div className="bg-white p-4 md:p-6 shadow-lg rounded-xl flex-grow min-h-[500px]">
            {loading ? (
              <div className="h-full flex items-center justify-center"><p className="font-bold text-gray-500">데이터를 불러오는 중입니다...</p></div>
            ) : quotations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-10 mt-4">
                <span className="text-4xl mb-3 opacity-50">📭</span>
                <p className="text-gray-500 font-bold">해당 조건에 맞는 견적 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="animate-fade-in-up">
                {/* PC 테이블 뷰 */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-200">
                        <th className="p-3 font-bold text-gray-700 w-32">견적서 번호</th>
                        <th className="p-3 font-bold text-gray-700 whitespace-nowrap">작성일자</th>
                        <th className="p-3 font-extrabold text-yellow-700">거래처명</th>
                        <th className="p-3 font-bold text-gray-700">품목명</th>
                        <th className="p-3 text-right font-extrabold text-yellow-700 whitespace-nowrap">총 견적금액</th>
                        <th className="p-3 text-center font-bold text-gray-700 whitespace-nowrap">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotations.map((q) => (
                        <tr key={q.id} className="border-b hover:bg-gray-50 transition text-sm">
                          <td className="p-3 font-medium text-gray-500 truncate max-w-[100px] sm:max-w-[120px]">{q.quotation_no}</td>
                          <td className="p-3 text-gray-600 font-bold whitespace-nowrap">{new Date(q.created_at).toLocaleDateString()}</td>
                          <td className="p-3 font-extrabold text-yellow-800 whitespace-nowrap">{q.clients?.name || '삭제된 거래처'}</td>
                          <td className="p-3 font-extrabold text-gray-800 truncate max-w-[200px] lg:max-w-[350px]" title={getProductName(q.quotation_items)}>{getProductName(q.quotation_items)}</td>                          
                          <td className="p-3 text-right font-extrabold text-yellow-700 whitespace-nowrap">{q.total_amount.toLocaleString()}원</td>
                          <td className="p-3 text-center space-x-1 whitespace-nowrap">
                            <Link href={`/quotation/${q.id}`} className="inline-block text-blue-600 font-bold px-2 py-1 border border-blue-200 rounded bg-white text-xs hover:bg-blue-50 transition shadow-sm">보기</Link>
                            <button onClick={() => handleCopyQuotationList(q.id)} className="inline-block text-purple-600 font-bold px-2 py-1 border border-purple-200 rounded bg-white text-xs hover:bg-purple-50 transition shadow-sm">복사</button>
                            <button onClick={() => handleDelete(q.id)} className="inline-block text-red-500 font-bold px-2 py-1 border border-red-200 rounded bg-white text-xs hover:bg-red-50 transition shadow-sm">삭제</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 모바일 카드 뷰 */}
                <div className="md:hidden space-y-4">
                  {quotations.map((q) => (
                    <div key={q.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm relative">
                      <div className="flex justify-between items-center mb-3 border-b border-dashed pb-2">
                        <span className="text-sm font-medium text-gray-500">{new Date(q.created_at).toLocaleDateString()}</span>
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded truncate max-w-[120px]">{q.quotation_no}</span>
                      </div>
                      <div className="mb-4">
                        <h3 className="font-extrabold text-xl text-yellow-800">{q.clients?.name || '삭제된 거래처'}</h3>
                        <p className="text-sm font-medium text-gray-600 mt-1 truncate">품목: {getProductName(q.quotation_items)}</p>
                      </div>
                      <div className="flex justify-between items-end">
                        <div></div>
                        <div className="text-right flex flex-col items-end">
                          <p className="font-extrabold text-xl text-yellow-700 mb-2">{q.total_amount.toLocaleString()}원</p>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleDelete(q.id)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold transition hover:bg-red-100">삭제</button>
                            <button onClick={() => handleCopyQuotationList(q.id)} className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-2 rounded-lg text-sm font-bold transition hover:bg-purple-100">복사</button>
                            <Link href={`/quotation/${q.id}`} className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg text-sm font-bold text-center transition hover:bg-blue-100">보기</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}