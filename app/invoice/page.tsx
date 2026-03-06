"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 타입 지정 (빌드 에러 방지)
interface Client {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  spec: string;
  price: number;
  is_vat_included: boolean;
}

interface InvoiceItem {
  product_id: string;
  name: string;
  spec: string;
  qty: number;
  price: number;
  is_vat_included: boolean;
}

// 제이테크 명세서 프로그램 (DB 연동, 자동 계산 및 invoice_no 오류 해결)
export default function InvoicePage() {
  // DB에서 불러올 데이터 상태
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // 폼 입력 상태
  const [selectedClientId, setSelectedClientId] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([{ product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);
  const [isSaving, setIsSaving] = useState(false);

  // 1. 거래처 및 품목 데이터 불러오기
  useEffect(() => {
    const fetchData = async () => {
      const { data: clientsData } = await supabase.from('clients').select('id, name').order('created_at', { ascending: false });
      const { data: productsData } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      
      if (clientsData) setClients(clientsData);
      if (productsData) setProducts(productsData);
    };
    fetchData();
  }, []);

  // 기존 기능 유지: 품목 추가
  const addItem = () => setItems([...items, { product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);

  // 품목 선택 시 단가 및 정보 자동 입력
  const handleProductSelect = (index: number, productId: string) => {
    const selectedProduct = products.find(p => p.id === productId);
    const newItems = [...items];
    
    if (selectedProduct) {
      newItems[index] = {
        product_id: selectedProduct.id,
        name: selectedProduct.name,
        spec: selectedProduct.spec || '',
        qty: 1, // 기본 수량 1
        price: selectedProduct.price,
        is_vat_included: selectedProduct.is_vat_included
      };
    } else {
      newItems[index] = { product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false };
    }
    setItems(newItems);
  };

  // 기존 기능 유지 + 신규 추가: 빌드 에러 방지용 안전한 인쇄 기능
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // 계산 로직: 공급가액, 부가세, 총합 자동 계산
  let supplyTotal = 0;
  let vatTotal = 0;

  items.forEach(item => {
    const lineTotal = item.qty * item.price;
    if (item.is_vat_included) {
      // 부가세 포함 단가인 경우: 공급가액 = 총액 / 1.1, 부가세 = 총액 - 공급가액
      const supply = Math.round(lineTotal / 1.1);
      supplyTotal += supply;
      vatTotal += (lineTotal - supply);
    } else {
      // 부가세 별도 단가인 경우: 공급가액 = 총액, 부가세 = 공급가액 * 0.1
      supplyTotal += lineTotal;
      vatTotal += Math.round(lineTotal * 0.1);
    }
  });

  const grandTotal = supplyTotal + vatTotal;

  // DB에 거래명세표 저장 기능 (invoice_no 자동 생성 추가)
  const handleSave = async () => {
    if (!selectedClientId) {
      alert('거래처를 선택해주세요.');
      return;
    }
    if (items.some(item => !item.product_id || item.qty <= 0)) {
      alert('모든 품목을 올바르게 선택하고 수량을 입력해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      
      // 본사(제이테크) ID 가져오기
      const { data: companyData, error: companyError } = await supabase.from('companies').select('id').limit(1).single();
      if (companyError || !companyData) throw new Error('본사 정보 오류');

      // 실무용 명세서 번호 자동 생성 (예: INV-20260307-1234)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const generatedInvoiceNo = `INV-${dateStr}-${randomStr}`;

      // 1. invoices 테이블에 저장 (invoice_no 컬럼 데이터 추가)
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          company_id: companyData.id,
          client_id: selectedClientId,
          invoice_no: generatedInvoiceNo, // <-- 오류 해결: 명세서 번호 추가
          supply_amount: supplyTotal,
          vat_amount: vatTotal,
          total_amount: grandTotal
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // 2. invoice_items 테이블에 상세 내역 저장
      const itemsToInsert = items.map(item => ({
        invoice_id: invoiceData.id,
        product_id: item.product_id,
        name: item.name,
        spec: item.spec,
        qty: item.qty,
        price: item.price
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      
      if (itemsError) throw itemsError;

      alert('거래명세표가 성공적으로 저장되었습니다. (명세서 번호: ' + generatedInvoiceNo + ')');
      // 폼 초기화
      setSelectedClientId('');
      setItems([{ product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);

    } catch (error: any) {
      console.error('명세서 저장 에러:', error.message);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black">
      <div className="max-w-4xl mx-auto bg-white p-6 shadow-lg rounded-lg" id="invoice-area">
        <h1 className="text-2xl font-bold mb-6 border-b pb-2">J-TECH 명세서 시스템</h1>
        
        {/* 거래처 정보 (기존 폼 유지 및 셀렉트 박스로 업그레이드) */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">거래처명</label>
          <select 
            className="w-full border rounded p-2 outline-none focus:border-blue-500" 
            value={selectedClientId} 
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">거래처를 선택하세요</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>

        {/* 품목 리스트 (기존 폼 유지 및 DB 연동) */}
        <div className="overflow-x-auto">
          <table className="w-full mb-4 border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-100 text-left text-sm">
                <th className="p-2 border">품목 선택</th>
                <th className="p-2 border">수량</th>
                <th className="p-2 border">단가</th>
                <th className="p-2 border text-right">합계</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="text-sm">
                  <td className="border p-2">
                    <select 
                      className="w-full outline-none bg-transparent"
                      value={item.product_id}
                      onChange={(e) => handleProductSelect(idx, e.target.value)}
                    >
                      <option value="">품목을 선택하세요</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} {p.spec ? `(${p.spec})` : ''}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border p-2">
                    <input type="number" className="w-full outline-none text-right" 
                      value={item.qty || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].qty = Number(e.target.value);
                        setItems(newItems);
                      }}
                      placeholder="0"
                    />
                  </td>
                  <td className="border p-2">
                    <input type="number" className="w-full outline-none text-right bg-gray-50" 
                      value={item.price || ''}
                      readOnly
                      title="단가는 품목 관리에서 수정 가능합니다."
                    />
                  </td>
                  <td className="border p-2 text-right font-medium">
                    {(item.qty * item.price).toLocaleString()}원
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 버튼 영역: 기존 폼 유지 및 저장 버튼 추가 */}
        <div className="flex justify-between items-center mb-6 print:hidden border-b pb-6">
          <button onClick={addItem} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition text-sm">
            + 품목 줄 추가
          </button>
          
          <div className="space-x-2">
            <button onClick={handleSave} disabled={isSaving} className={`px-4 py-2 rounded text-white font-bold transition text-sm ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isSaving ? '저장 중...' : 'DB에 명세서 저장'}
            </button>
            <button onClick={handlePrint} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition font-bold text-sm">
              명세서 인쇄 (PDF)
            </button>
          </div>
        </div>

        {/* 총 합계 (기존 폼 유지 및 공급가/부가세 세분화) */}
        <div className="text-right space-y-1">
          <div className="text-gray-600">공급가액: {supplyTotal.toLocaleString()}원</div>
          <div className="text-gray-600">부가세: {vatTotal.toLocaleString()}원</div>
          <div className="text-2xl font-bold pt-2">
            총 합계 금액: <span className="text-blue-600">{grandTotal.toLocaleString()}원</span>
          </div>
        </div>
      </div>
    </div>
  );
}