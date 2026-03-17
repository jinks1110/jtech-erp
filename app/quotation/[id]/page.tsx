"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface QuotationDetail {
  id: string;
  quotation_no: string;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  created_at: string;
  clients: { name: string; business_number: string; address: string; contact: string; };
  companies: { name: string; business_number: string; ceo_name: string; address: string; contact: string; };
}

interface QuotationItem { id?: string; name: string; spec: string; qty: number; price: number; is_vat_included?: boolean; }

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const { data: invData } = await supabase.from('quotations').select('*, clients (name, business_number, address, contact), companies (name, business_number, ceo_name, address, contact)').eq('id', params.id).single();
        setQuotation(invData as unknown as QuotationDetail);
        const { data: itemsData } = await supabase.from('quotation_items').select('*').eq('quotation_id', params.id).order('created_at', { ascending: true });
        setItems(itemsData || []);
      } catch (error) {
        alert('조회 실패');
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchDetail();
  }, [params.id]);

  if (loading) return <div className="p-10 text-center">데이터를 불러오는 중입니다...</div>;
  if (!quotation) return <div className="p-10 text-center">견적서를 찾을 수 없습니다.</div>;

  // 빈칸 5줄만 추가해서 높이가 길어지는 것을 방지
  const minRows = 5; 
  const totalRows = Math.max(minRows, items.length);

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen text-black print:bg-white print:p-0">
      
      {/* === 인쇄 여백 완전 ZERO(0) 처리 및 A4 강제 사이즈 고정 === */}
      <style dangerouslySetInnerHTML={{ 
        __html: `
          @media print { 
            @page { size: A4 portrait; margin: 0 !important; } 
            body { margin: 0; padding: 0; background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
            /* A4 용지 규격 210x297mm, 컨테이너 높이를 296mm로 막아버림 */
            .print-safe-container { width: 210mm; height: 296mm; box-sizing: border-box; padding: 15mm; overflow: hidden; page-break-inside: avoid; margin: 0 auto; border: none !important; box-shadow: none !important; }
            .no-print { display: none !important; }
          }
        ` 
      }} />

      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center no-print bg-white p-4 shadow rounded-lg">
        <button onClick={() => router.back()} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 font-bold text-sm">← 목록으로</button>
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-extrabold text-sm shadow animate-pulse hover:animate-none">🖨️ 견적서 인쇄 (A4)</button>
      </div>

      {/* 강제 고정 컨테이너 */}
      <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg border border-gray-300 print-safe-container flex flex-col">
        <h1 className="text-4xl font-extrabold text-center mb-8 tracking-[1em] underline underline-offset-8 decoration-2 shrink-0">견 적 서</h1>
        
        <div className="flex justify-between items-start mb-6 shrink-0">
          <div className="w-1/2 pr-4">
            <div className="flex items-end mb-2 border-b-2 border-black pb-1">
              <span className="text-2xl font-bold">{quotation.clients?.name}</span>
              <span className="text-lg ml-2">귀하</span>
            </div>
            <p className="text-sm font-bold text-gray-600 mb-6">견적일자: {new Date(quotation.created_at).toLocaleDateString()}</p>
            <div className="bg-gray-100 p-3 border border-black text-sm">
              <p className="font-bold text-lg mb-1">견적 총액: ￦ {quotation.total_amount.toLocaleString()}</p>
              <p className="text-gray-700">( 부가세 포함 금액 )</p>
            </div>
            <p className="mt-4 text-sm font-bold">아래와 같이 견적합니다.</p>
          </div>

          <div className="w-1/2 pl-4">
            <table className="w-full border-collapse border border-black text-xs md:text-sm">
              <tbody>
                <tr><th rowSpan={4} className="border border-black bg-gray-100 p-1 w-6 text-center leading-tight">공<br/>급<br/>자</th><th className="border border-black bg-gray-100 p-1 w-16">등록번호</th><td colSpan={3} className="border border-black p-1 font-bold text-center">{quotation.companies?.business_number}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-1">상호(명)</th><td className="border border-black p-1 font-bold">{quotation.companies?.name}</td><th className="border border-black bg-gray-100 p-1 w-10">성명</th><td className="border border-black p-1 text-center">{quotation.companies?.ceo_name}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-1">사업장주소</th><td colSpan={3} className="border border-black p-1 truncate max-w-[150px] text-[10px] leading-tight">{quotation.companies?.address}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-1">연락처</th><td colSpan={3} className="border border-black p-1">{quotation.companies?.contact}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex-grow">
          <table className="w-full border-collapse border border-black text-sm mb-4 table-fixed">
            <thead>
              <tr className="bg-gray-100 text-center font-bold">
                <th className="p-2 border border-black w-10">No</th>
                <th className="p-2 border border-black w-48">품 명</th>
                <th className="p-2 border border-black w-24">규 격</th>
                <th className="p-2 border border-black w-16">수 량</th>
                <th className="p-2 border border-black w-24">단 가</th>
                <th className="p-2 border border-black w-28">금 액</th>
                <th className="p-2 border border-black w-20">비 고</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: totalRows }).map((_, idx) => {
                const item = items[idx];
                if (!item) return (<tr key={idx} className="h-7"><td className="border border-black text-transparent select-none">.</td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td></tr>);
                return (
                  <tr key={idx} className="text-center h-7">
                    <td className="border border-black">{idx + 1}</td>
                    <td className="border border-black text-left px-2 font-bold truncate">{item.name}</td>
                    <td className="border border-black text-xs truncate">{item.spec}</td>
                    <td className="border border-black">{item.qty}</td>
                    <td className="border border-black text-right px-2">{item.price.toLocaleString()}</td>
                    <td className="border border-black text-right px-2 font-bold">{(item.qty * item.price).toLocaleString()}</td>
                    <td className="border border-black text-xs text-gray-500">{item.is_vat_included ? 'VAT포함' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 font-extrabold border-t-2 border-black">
                <td colSpan={5} className="border border-black p-2 text-center tracking-widest">합 계</td>
                <td colSpan={2} className="border border-black p-2 text-right pr-6">{quotation.supply_amount.toLocaleString()}</td>
              </tr>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={5} className="border border-black p-2 text-center">부 가 세</td>
                <td colSpan={2} className="border border-black p-2 text-right pr-6">{quotation.vat_amount.toLocaleString()}</td>
              </tr>
              <tr className="bg-white font-extrabold text-lg">
                <td colSpan={5} className="border border-black p-2 text-center">총 견 적 액</td>
                <td colSpan={2} className="border border-black p-2 text-right pr-6 text-blue-800">￦ {quotation.total_amount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 문구가 짤리지 않도록 하단에 강력 접착 */}
        <div className="shrink-0 mt-4 pt-4 border-t-2 border-black text-sm space-y-1 text-gray-800 pb-2">
          <p className="font-bold">1. 견적 유효기간 : 견적일로부터 15일</p>
          <p className="font-bold">2. 결제 조건 : 납품 후 협의 (세금계산서 발행 가능)</p>
          <p className="font-bold">3. 납품 장소 : 귀사 지정 장소</p>
        </div>
      </div>
    </div>
  );
}