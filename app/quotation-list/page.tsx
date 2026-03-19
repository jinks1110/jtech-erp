"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Quotation {
  id: string; quotation_no: string; created_at: string; total_amount: number; client_id: string;
  clients: { name: string; }; quotation_items: { name: string; }[];
}

export default function QuotationListPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState(''); const [selectedClientId, setSelectedClientId] = useState('');

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', desc: '', confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm: async () => {}
  });
  const closeModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile) return;
      const { data: clientsData } = await supabase.from('clients').select('id, name').eq('company_id', profile.company_id).order('name', { ascending: true });
      if (clientsData) setClients(clientsData);
    };
    fetchInitialData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();

      let query = supabase.from('quotations').select(`id, quotation_no, created_at, total_amount, client_id, clients ( name ), quotation_items ( name )`).eq('company_id', profile!.company_id).order('created_at', { ascending: false });
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

  useEffect(() => { fetchData(); }, [startDate, endDate, selectedClientId]);

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
          const { data: oldQuote, error: qError } = await supabase.from('quotations').select('*').eq('id', quotationId).single();
          if (qError) throw qError;
          const { data: oldItems, error: iError } = await supabase.from('quotation_items').select('*').eq('quotation_id', quotationId);
          if (iError) throw iError;

          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          const generatedQuotationNo = `EST-${dateStr}-${randomStr}`;

          const { data: newQuote, error: insertQError } = await supabase.from('quotations').insert([{
            company_id: oldQuote.company_id, client_id: oldQuote.client_id, quotation_no: generatedQuotationNo,
            supply_amount: oldQuote.supply_amount, vat_amount: oldQuote.vat_amount, total_amount: oldQuote.total_amount
          }]).select().single();
          if (insertQError) throw insertQError;

          const itemsToInsert = oldItems.map(item => ({
            quotation_id: newQuote.id, product_id: item.product_id, name: item.name, spec: item.spec, qty: item.qty, price: item.price
          }));
          const { error: insertIError } = await supabase.from('quotation_items').insert(itemsToInsert);
          if (insertIError) throw insertIError;

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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black relative">
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 print:hidden">
          <div className="absolute inset-0 bg-transparent" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border-2 border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
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

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-4 md:p-6 shadow-lg rounded-lg border-t-4 border-yellow-500">
          <h1 className="text-xl md:text-2xl font-bold mb-6">견적내역 관리 및 조회</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
            <div><label className="block text-sm font-bold mb-1">시작일</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none" /></div>
            <div><label className="block text-sm font-bold mb-1">종료일</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none" /></div>
            <div>
              <label className="block text-sm font-bold mb-1">거래처 필터</label>
              <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none">
                <option value="">전체 거래처</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 shadow-lg rounded-lg">
          {loading ? <p className="text-center py-10">로딩 중...</p> : quotations.length === 0 ? <p className="text-center py-10">견적 내역이 없습니다.</p> : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left text-sm border-b-2">
                      <th className="p-3">작성일자</th><th className="p-3">견적서 번호</th><th className="p-3 w-48">품목명</th>
                      <th className="p-3">거래처명</th><th className="p-3 text-right">총 견적금액</th><th className="p-3 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map(q => (
                      <tr key={q.id} className="border-b hover:bg-gray-50 text-sm transition">
                        <td className="p-3 text-gray-600 whitespace-nowrap">{new Date(q.created_at).toLocaleDateString()}</td>
                        <td className="p-3 font-medium text-gray-900 whitespace-nowrap">{q.quotation_no}</td>
                        <td className="p-3 font-medium text-gray-700 truncate max-w-[200px]" title={getProductName(q.quotation_items)}>{getProductName(q.quotation_items)}</td>
                        <td className="p-3 font-bold text-yellow-700 whitespace-nowrap">{q.clients?.name}</td>
                        <td className="p-3 text-right font-bold text-gray-900 whitespace-nowrap">{q.total_amount.toLocaleString()}원</td>
                        <td className="p-3 text-center space-x-1 whitespace-nowrap">
                          <Link href={`/quotation/${q.id}`} className="inline-block text-blue-600 font-bold px-2 py-1 border border-blue-200 rounded bg-white text-xs hover:bg-blue-50 transition">보기</Link>
                          <button onClick={() => handleCopyQuotationList(q.id)} className="inline-block text-purple-600 font-bold px-2 py-1 border border-purple-200 rounded bg-white text-xs hover:bg-purple-50 transition">복사</button>
                          <button onClick={() => handleDelete(q.id)} className="inline-block text-red-500 font-bold px-2 py-1 border border-red-200 rounded bg-white text-xs hover:bg-red-50 transition">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-4">
                {quotations.map(q => (
                  <div key={q.id} className="bg-white border-2 rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-500">{new Date(q.created_at).toLocaleDateString()}</span>
                      <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">{q.quotation_no}</span>
                    </div>
                    <div className="mb-3">
                      <h3 className="font-extrabold text-lg text-yellow-700 mb-1">{q.clients?.name}</h3>
                      <p className="text-sm font-medium text-gray-600 truncate">품목: {getProductName(q.quotation_items)}</p>
                    </div>
                    <div className="flex justify-between items-end border-t pt-3">
                      <p className="font-extrabold text-xl text-gray-900">{q.total_amount.toLocaleString()}원</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDelete(q.id)} className="bg-red-50 text-red-600 border px-3 py-2 rounded-lg text-sm font-bold">삭제</button>
                        <button onClick={() => handleCopyQuotationList(q.id)} className="bg-purple-50 text-purple-700 border px-3 py-2 rounded-lg text-sm font-bold">복사</button>
                        <Link href={`/quotation/${q.id}`} className="bg-blue-50 text-blue-700 border px-3 py-2 rounded-lg text-sm font-bold">보기</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}