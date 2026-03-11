"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoice_no: string;
  created_at: string;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  client_id: string;
  clients: {
    name: string;
  };
}

export default function SalesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 상태
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile) throw new Error('회사 정보가 없습니다.');

      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .order('name', { ascending: true });

      if (clientsData) setClients(clientsData);

      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_no,
          created_at,
          supply_amount,
          vat_amount,
          total_amount,
          client_id,
          clients ( name )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

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
    fetchData();
  }, [startDate, endDate, selectedClientId]);

  const exportToExcel = () => {
    if (invoices.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const excelData = invoices.map((inv, index) => ({
      'No': index + 1,
      '문서번호': inv.invoice_no,
      '작성일자': new Date(inv.created_at).toLocaleDateString(),
      '거래처명': inv.clients?.name || '알 수 없음',
      '공급가액': inv.supply_amount,
      '부가세': inv.vat_amount,
      '총합계': inv.total_amount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "매출내역");
    
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `JTECH_매출내역_${today}.xlsx`);
  };

  const totalSupply = invoices.reduce((sum, inv) => sum + (inv.supply_amount || 0), 0);
  const totalVat = invoices.reduce((sum, inv) => sum + (inv.vat_amount || 0), 0);
  const grandTotal = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-white p-6 shadow-lg rounded-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
            <h1 className="text-2xl font-bold">매출 및 명세서 조회</h1>
            <button 
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow flex items-center gap-2 transition"
            >
              <span>📊</span> 엑셀 다운로드
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded border">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">시작일</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">종료일</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">거래처 필터</label>
              <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500 bg-white">
                <option value="">전체 거래처</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
            <p className="text-sm text-gray-500 font-medium mb-1">총 공급가액</p>
            <p className="text-2xl font-bold">{totalSupply.toLocaleString()}원</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
            <p className="text-sm text-gray-500 font-medium mb-1">총 부가세</p>
            <p className="text-2xl font-bold">{totalVat.toLocaleString()}원</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
            <p className="text-sm text-gray-500 font-medium mb-1">합계 금액 (조회 결과)</p>
            <p className="text-2xl font-bold text-green-700">{grandTotal.toLocaleString()}원</p>
          </div>
        </div>

        <div className="bg-white p-6 shadow-lg rounded-lg overflow-hidden">
          {loading ? (
            <p className="text-center text-gray-500 py-10">데이터를 불러오는 중입니다...</p>
          ) : invoices.length === 0 ? (
            <p className="text-center text-gray-500 py-10">조건에 맞는 매출 내역이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-200">
                    <th className="p-3">작성일자</th>
                    <th className="p-3">문서번호</th>
                    <th className="p-3">거래처명</th>
                    <th className="p-3 text-right">공급가액</th>
                    <th className="p-3 text-right">부가세</th>
                    <th className="p-3 text-right">총합계</th>
                    <th className="p-3 text-center">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-gray-50 transition text-sm">
                      <td className="p-3 text-gray-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="p-3 font-medium text-gray-900">{inv.invoice_no}</td>
                      <td className="p-3 font-bold text-blue-800">{inv.clients?.name || '삭제된 거래처'}</td>
                      <td className="p-3 text-right">{inv.supply_amount.toLocaleString()}원</td>
                      <td className="p-3 text-right text-gray-500">{inv.vat_amount.toLocaleString()}원</td>
                      <td className="p-3 text-right font-bold text-green-700">{inv.total_amount.toLocaleString()}원</td>
                      <td className="p-3 text-center">
                        {/* 🚨 원인 해결: 잘못된 invoice 경로를 원래 만들어둔 sales 경로로 완벽하게 수정했습니다. */}
                        <Link 
                          href={`/sales/${inv.id}`} 
                          className="inline-block text-blue-600 hover:text-blue-800 font-bold px-3 py-1 border border-blue-200 rounded bg-white text-xs hover:bg-blue-50 transition"
                        >
                          보기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}