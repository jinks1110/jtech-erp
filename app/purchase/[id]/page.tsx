"use client";

import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface PurchaseItem {
  id: string;
  name: string;
  spec: string;
  qty: number;
  price: number;
}

interface Purchase {
  id: string;
  purchase_no: string;
  created_at: string;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  clients: { name: string; };
}

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  
  const resolvedParams = use(params);
  const purchaseId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [companyName, setCompanyName] = useState('J-TECH');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return router.push('/login');

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        const { data: compData } = await supabase.from('companies').select('name').eq('id', profile!.company_id).single();
        if (compData) setCompanyName(compData.name);

        const { data: pData, error: pError } = await supabase.from('purchases').select('*, clients(name)').eq('id', purchaseId).single();
        if (pError) throw pError;
        setPurchase(pData as any);

        const { data: iData, error: iError } = await supabase.from('purchase_items').select('*').eq('purchase_id', purchaseId).order('id');
        if (iError) throw iError;
        setItems(iData);

      } catch (error) {
        console.error(error);
        alert('데이터를 불러오지 못했습니다.');
        router.push('/purchase');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [purchaseId, router]); 

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">로딩 중...</div>;
  if (!purchase) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">매입 내역을 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-10 font-sans print:bg-white print:p-0">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .print-hidden { display: none !important; }
        }
      `}} />

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* === 모든 emerald를 기본 색상인 green으로 교체 === */}
        <div className="print-hidden flex justify-between items-center bg-white p-4 rounded-xl shadow-md border-l-4 border-green-600">
          <h2 className="text-xl font-extrabold text-gray-800">매입 전표 상세조회</h2>
          <div className="flex gap-2">
            <button onClick={() => router.push('/purchase')} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition text-sm">목록으로</button>
            <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition text-sm flex items-center gap-1">🖨️ 인쇄하기</button>
          </div>
        </div>

        {/* 인쇄용 A4 영역 */}
        <div className="bg-white p-8 md:p-12 shadow-2xl rounded-sm border border-gray-200 print:shadow-none print:border-none">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold tracking-widest text-gray-900 border-b-4 border-gray-800 pb-4 inline-block px-10">매 입 전 표</h1>
          </div>

          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-sm font-bold text-gray-500 mb-1">문서번호: <span className="text-gray-800">{purchase.purchase_no}</span></p>
              <p className="text-sm font-bold text-gray-500 mb-1">매입일자: <span className="text-gray-800">{new Date(purchase.created_at).toLocaleDateString()}</span></p>
              <div className="mt-4">
                <span className="text-2xl font-extrabold text-green-800 border-b-2 border-green-800 pb-1">{purchase.clients?.name}</span> <span className="text-lg font-bold text-gray-600">귀하</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-500 mb-1">공급받는자 (우리회사)</p>
              <p className="text-lg font-extrabold text-gray-900">{companyName}</p>
            </div>
          </div>

          <div className="bg-green-50/50 p-4 border border-green-200 rounded-lg flex justify-between items-center mb-8 shadow-sm">
            <span className="text-lg font-extrabold text-green-900">합계금액 (공급가액 + 세액)</span>
            <span className="text-3xl font-extrabold text-green-700">￦ {purchase.total_amount.toLocaleString()}</span>
          </div>

          <table className="w-full border-collapse border-t-2 border-b-2 border-gray-800 text-sm text-center">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 font-bold w-12 border-b border-gray-300 text-gray-700">No</th>
                <th className="py-3 font-bold border-b border-gray-300 text-gray-700">품목명</th>
                <th className="py-3 font-bold w-32 border-b border-gray-300 text-gray-700">규격</th>
                <th className="py-3 font-bold w-16 border-b border-gray-300 text-gray-700">수량</th>
                <th className="py-3 font-bold w-28 border-b border-gray-300 text-gray-700">단가</th>
                <th className="py-3 font-bold w-32 border-b border-gray-300 text-gray-700">공급가액</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="h-12 border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="px-2 text-gray-500 font-medium">{idx + 1}</td>
                  <td className="px-2 text-left font-extrabold text-gray-800">{item.name}</td>
                  <td className="px-2 text-gray-500">{item.spec || ''}</td>
                  <td className="px-2 font-bold text-blue-600">{item.qty.toLocaleString()}</td>
                  <td className="px-2 text-right font-medium text-gray-700">{item.price.toLocaleString()}</td>
                  <td className="px-2 text-right font-extrabold text-gray-900">{(item.qty * item.price).toLocaleString()}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, idx) => (
                <tr key={`empty-${idx}`} className="h-12 border-b border-gray-100 last:border-none">
                  <td></td><td></td><td></td><td></td><td></td><td></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mt-6 border-t border-b border-gray-300 bg-gray-50/50">
             <div className="w-1/3 p-4 border-r border-gray-200">
               <p className="text-xs font-bold text-gray-500 mb-1">공급가액 합계</p>
               <p className="text-lg font-extrabold text-gray-800 text-right">{purchase.supply_amount.toLocaleString()} 원</p>
             </div>
             <div className="w-1/3 p-4 border-r border-gray-200">
               <p className="text-xs font-bold text-gray-500 mb-1">세액 합계</p>
               <p className="text-lg font-extrabold text-gray-800 text-right">{purchase.vat_amount.toLocaleString()} 원</p>
             </div>
             <div className="w-1/3 p-4 bg-green-50">
               <p className="text-xs font-bold text-green-700 mb-1">총 매입액</p>
               <p className="text-2xl font-extrabold text-green-800 text-right">{purchase.total_amount.toLocaleString()} 원</p>
             </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}