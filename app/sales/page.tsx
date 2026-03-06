"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // 신규 추가: 페이지 이동용 라우터
import { supabase } from '@/lib/supabase';

// 타입 지정 (빌드 에러 및 조인 데이터 타입 오류 완벽 방지)
interface Client {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoice_no: string;
  issue_date: string;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  client_id: string;
  clients: {
    name: string;
  };
}

// 제이테크 매출 조회 페이지 (검색 및 월별 합계 + 상세 보기 연결 완료)
export default function SalesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // 라우터 초기화
  const router = useRouter();

  // 검색 필터 상태
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClient, setSelectedClient] = useState('');

  // 1. 거래처 목록 불러오기 (검색용 드롭다운)
  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from('clients').select('id, name').order('name', { ascending: true });
      if (data) setClients(data);
    };
    fetchClients();
  }, []);

  // 2. 매출 내역(거래명세표) 불러오기 및 필터링
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('invoices')
        .select(`
          id, 
          invoice_no, 
          issue_date, 
          supply_amount, 
          vat_amount, 
          total_amount, 
          client_id,
          clients (name)
        `)
        .order('issue_date', { ascending: false });

      if (selectedClient) {
        query = query.eq('client_id', selectedClient);
      }
      if (startDate) {
        query = query.gte('issue_date', startDate);
      }
      if (endDate) {
        query = query.lte('issue_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setInvoices(data as unknown as Invoice[]);

    } catch (error: any) {
      console.error('매출 조회 에러:', error.message);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [startDate, endDate, selectedClient]);

  // 화면에 표시된 내역들의 총 합계 계산 (실시간 자동 계산)
  const totalSupply = invoices.reduce((acc, curr) => acc + curr.supply_amount, 0);
  const totalVat = invoices.reduce((acc, curr) => acc + curr.vat_amount, 0);
  const totalSales = invoices.reduce((acc, curr) => acc + curr.total_amount, 0);

  // 검색 조건 초기화 버튼 기능
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedClient('');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 상단: 검색 및 필터 영역 */}
        <div className="bg-white p-6 shadow-lg rounded-lg">
          <h1 className="text-2xl font-bold mb-6 border-b pb-2">매출 조회 및 검색</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">시작일</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">종료일</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">거래처 선택</label>
              <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500 bg-white">
                <option value="">전체 거래처</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div>
              <button onClick={resetFilters} className="w-full bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-300 transition">
                필터 초기화
              </button>
            </div>
          </div>
        </div>

        {/* 중단: 매출 합계 요약 대시보드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 shadow rounded-lg border-l-4 border-gray-500">
            <h3 className="text-gray-500 text-sm font-bold mb-1">검색된 공급가액 합계</h3>
            <p className="text-2xl font-bold">{totalSupply.toLocaleString()}원</p>
          </div>
          <div className="bg-white p-6 shadow rounded-lg border-l-4 border-gray-400">
            <h3 className="text-gray-500 text-sm font-bold mb-1">검색된 부가세 합계</h3>
            <p className="text-2xl font-bold">{totalVat.toLocaleString()}원</p>
          </div>
          <div className="bg-white p-6 shadow rounded-lg border-l-4 border-blue-600">
            <h3 className="text-blue-600 text-sm font-bold mb-1">검색된 총 매출액 (합계)</h3>
            <p className="text-3xl font-extrabold text-blue-700">{totalSales.toLocaleString()}원</p>
          </div>
        </div>

        {/* 하단: 매출 상세 리스트 */}
        <div className="bg-white p-6 shadow-lg rounded-lg">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">거래명세표 발행 내역 ({invoices.length}건)</h2>
          
          {loading ? (
            <p className="text-center text-gray-500 py-10">데이터를 불러오는 중입니다...</p>
          ) : invoices.length === 0 ? (
            <p className="text-center text-gray-500 py-10">해당 조건의 매출 내역이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm">
                    <th className="p-3 border">발행일자</th>
                    <th className="p-3 border">명세서 번호</th>
                    <th className="p-3 border">거래처명</th>
                    <th className="p-3 border text-right">공급가액</th>
                    <th className="p-3 border text-right">부가세</th>
                    <th className="p-3 border text-right">총 합계</th>
                    <th className="p-3 border text-center">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b hover:bg-gray-50 text-sm">
                      <td className="p-3">{invoice.issue_date}</td>
                      <td className="p-3 text-gray-500">{invoice.invoice_no}</td>
                      <td className="p-3 font-bold">{invoice.clients?.name || '알 수 없음'}</td>
                      <td className="p-3 text-right">{invoice.supply_amount.toLocaleString()}원</td>
                      <td className="p-3 text-right">{invoice.vat_amount.toLocaleString()}원</td>
                      <td className="p-3 text-right font-bold text-blue-600">{invoice.total_amount.toLocaleString()}원</td>
                      <td className="p-3 text-center">
                        {/* 신규 추가: 보기 버튼 클릭 시 동적 라우팅으로 상세 페이지 이동 */}
                        <button 
                          onClick={() => router.push(`/sales/${invoice.id}`)}
                          className="bg-blue-50 text-blue-600 px-3 py-1 rounded text-xs font-bold hover:bg-blue-100 border border-blue-200"
                        >
                          보기
                        </button>
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