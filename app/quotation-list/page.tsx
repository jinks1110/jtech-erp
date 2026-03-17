"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Quotation {
  id: string;
  quotation_no: string;
  created_at: string;
  total_amount: number;
  client_id: string;
  clients: { name: string; };
  quotation_items: { name: string; }[];
}

export default function QuotationListPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');

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

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 이 견적서를 삭제하시겠습니까?')) return;
    try {
      await supabase.from('quotation_items').delete().eq('quotation_id', id);
      await supabase.from('quotations').delete().eq('id', id);
      alert('삭제되었습니다.');
      fetchData();
    } catch (error) {
      alert('삭제 실패');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
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
              {/* === 수정: PC 뷰 테이블 열 순서 변경 (견적서 번호 -> 품목명 -> 거래처명) === */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left text-sm border-b-2">
                      <th className="p-3">작성일자</th>
                      <th className="p-3">견적서 번호</th>
                      <th className="p-3 w-48">품목명</th>
                      <th className="p-3">거래처명</th>
                      <th className="p-3 text-right">총 견적금액</th>
                      <th className="p-3 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map(q => (
                      <tr key={q.id} className="border-b hover:bg-gray-50 text-sm transition">
                        <td className="p-3 text-gray-600 whitespace-nowrap">{new Date(q.created_at).toLocaleDateString()}</td>
                        <td className="p-3 font-medium text-gray-900 whitespace-nowrap">{q.quotation_no}</td>
                        <td className="p-3 font-medium text-gray-700 truncate max-w-[200px]" title={getProductName(q.quotation_items)}>
                          {getProductName(q.quotation_items)}
                        </td>
                        <td className="p-3 font-bold text-yellow-700 whitespace-nowrap">{q.clients?.name}</td>
                        <td className="p-3 text-right font-bold text-gray-900 whitespace-nowrap">{q.total_amount.toLocaleString()}원</td>
                        <td className="p-3 text-center space-x-2 whitespace-nowrap">
                          <Link href={`/quotation/${q.id}`} className="text-blue-600 font-bold px-3 py-1 border border-blue-200 rounded bg-white text-xs hover:bg-blue-50 transition">보기</Link>
                          <button onClick={() => handleDelete(q.id)} className="text-red-500 font-bold px-3 py-1 border border-red-200 rounded bg-white text-xs hover:bg-red-50 transition">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* === 모바일 뷰 유지 === */}
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