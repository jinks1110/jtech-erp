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

  // === 신규 추가: 명세서 영구 삭제 핸들러 ===
  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm('정말 이 명세서를 삭제하시겠습니까?\n(경고: 관련된 품목 내역도 함께 영구 삭제되며 복구할 수 없습니다.)')) {
      return;
    }

    try {
      // 1. DB 외래키 제약조건 방지를 위해 자식 데이터(품목들) 먼저 완벽 삭제
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId);
        
      if (itemsError) throw itemsError;

      // 2. 부모 데이터(명세서 본체) 삭제
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      alert('명세서가 성공적으로 삭제되었습니다.');
      fetchData(); // 삭제 후 목록 즉시 갱신
      
    } catch (error: any) {
      console.error('삭제 에러:', error.message);
      alert('명세서 삭제에 실패했습니다.');
    }
  };

  const totalSupply = invoices.reduce((sum, inv) => sum + (inv.supply_amount || 0), 0);
  const totalVat = invoices.reduce((sum, inv) => sum + (inv.vat_amount || 0), 0);
  const grandTotal = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        
        <div className="bg-white p-4 md:p-6 shadow-lg rounded-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 md:mb-6 gap-4">
            <h1 className="text-xl md:text-2xl font-bold">매출 및 명세서 조회</h1>
            <button 
              onClick={exportToExcel}
              className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 md:py-2 px-4 rounded-lg shadow flex items-center justify-center gap-2 transition"
            >
              <span>📊</span> 엑셀 다운로드
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 bg-gray-50 p-3 md:p-4 rounded-lg border">
            <div>
              <label className="block text-xs md:text-sm font-bold mb-1 text-gray-700">시작일</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-bold mb-1 text-gray-700">종료일</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-bold mb-1 text-gray-700">거래처 필터</label>
              <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white">
                <option value="">전체 거래처</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
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
            <p className="text-sm text-gray-500 font-bold mb-1">총 합계 (조회 결과)</p>
            <p className="text-xl md:text-2xl font-extrabold text-green-700">{grandTotal.toLocaleString()}원</p>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 shadow-lg rounded-lg">
          {loading ? (
            <p className="text-center text-gray-500 py-10">데이터를 불러오는 중입니다...</p>
          ) : invoices.length === 0 ? (
            <p className="text-center text-gray-500 py-10">조건에 맞는 매출 내역이 없습니다.</p>
          ) : (
            <>
              {/* 1. 데스크탑 뷰 (표 형식) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-200">
                      <th className="p-3">작성일자</th>
                      <th className="p-3">문서번호</th>
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
                        <td className="p-3 text-gray-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                        <td className="p-3 font-medium text-gray-900">{inv.invoice_no}</td>
                        <td className="p-3 font-bold text-blue-800">{inv.clients?.name || '삭제된 거래처'}</td>
                        <td className="p-3 text-right">{inv.supply_amount.toLocaleString()}원</td>
                        <td className="p-3 text-right text-gray-500">{inv.vat_amount.toLocaleString()}원</td>
                        <td className="p-3 text-right font-bold text-green-700">{inv.total_amount.toLocaleString()}원</td>
                        <td className="p-3 text-center space-x-2">
                          <Link href={`/sales/${inv.id}`} className="inline-block text-blue-600 hover:text-blue-800 font-bold px-3 py-1 border border-blue-200 rounded bg-white text-xs hover:bg-blue-50 transition">
                            보기
                          </Link>
                          {/* 데스크탑: 삭제 버튼 추가 */}
                          <button onClick={() => handleDeleteInvoice(inv.id)} className="inline-block text-red-500 hover:text-red-700 font-bold px-3 py-1 border border-red-200 rounded bg-white text-xs hover:bg-red-50 transition">
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 2. 모바일 뷰 (카드 형식) */}
              <div className="md:hidden space-y-4">
                {invoices.map((inv) => (
                  <div key={inv.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm relative">
                    <div className="flex justify-between items-center mb-3 border-b border-dashed pb-2">
                      <span className="text-sm font-medium text-gray-500">{new Date(inv.created_at).toLocaleDateString()}</span>
                      <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">{inv.invoice_no}</span>
                    </div>
                    <div className="mb-4">
                      <h3 className="font-extrabold text-xl text-blue-800">{inv.clients?.name || '삭제된 거래처'}</h3>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><span className="inline-block w-12 font-medium">공급가:</span> {inv.supply_amount.toLocaleString()}원</p>
                        <p><span className="inline-block w-12 font-medium">부가세:</span> {inv.vat_amount.toLocaleString()}원</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <p className="font-extrabold text-xl text-green-700 mb-2">{inv.total_amount.toLocaleString()}원</p>
                        <div className="flex gap-2">
                          {/* 모바일: 삭제 버튼 추가 */}
                          <button onClick={() => handleDeleteInvoice(inv.id)} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold transition hover:bg-red-100">
                            삭제
                          </button>
                          <Link href={`/sales/${inv.id}`} className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-sm font-bold text-center transition hover:bg-blue-100">
                            명세서 열기
                          </Link>
                        </div>
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