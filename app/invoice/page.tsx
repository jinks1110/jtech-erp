"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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

export default function InvoicePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([{ product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', session.user.id)
          .single();
          
        const profile = data as { company_id: string } | null;

        if (profileError || !profile) {
          console.error("프로필 정보 없음:", profileError);
          return;
        }

        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name')
          .eq('company_id', profile.company_id)
          .eq('is_active', true) 
          .order('name', { ascending: true });
          
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .order('name', { ascending: true });
        
        if (clientsData) setClients(clientsData);
        if (productsData) setProducts(productsData);
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      }
    };
    fetchData();
  }, []);

  const addItem = () => setItems([...items, { product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const selectedProduct = products.find(p => p.id === productId);
    const newItems = [...items];
    
    if (selectedProduct) {
      newItems[index] = {
        product_id: selectedProduct.id,
        name: selectedProduct.name,
        spec: selectedProduct.spec || '',
        qty: 1,
        price: selectedProduct.price,
        is_vat_included: selectedProduct.is_vat_included
      };
    } else {
      newItems[index] = { product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false };
    }
    setItems(newItems);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  let supplyTotal = 0;
  let vatTotal = 0;

  items.forEach(item => {
    const lineTotal = item.qty * item.price;
    if (item.is_vat_included) {
      const supply = Math.round(lineTotal / 1.1);
      supplyTotal += supply;
      vatTotal += (lineTotal - supply);
    } else {
      supplyTotal += lineTotal;
      vatTotal += Math.round(lineTotal * 0.1);
    }
  });

  const grandTotal = supplyTotal + vatTotal;

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
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인 세션 만료');

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', session.user.id)
        .single();
        
      const profile = data as { company_id: string } | null;

      if (profileError || !profile) {
        alert("저장 오류: 소속된 회사(company_id) 정보를 찾을 수 없습니다.");
        setIsSaving(false);
        return;
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const generatedInvoiceNo = `INV-${dateStr}-${randomStr}`;

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          company_id: profile.company_id,
          client_id: selectedClientId,
          invoice_no: generatedInvoiceNo,
          supply_amount: supplyTotal,
          vat_amount: vatTotal,
          total_amount: grandTotal
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

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

      alert('거래명세표가 성공적으로 저장되었습니다. (번호: ' + generatedInvoiceNo + ')');
      setSelectedClientId('');
      setItems([{ product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);

    } catch (error: any) {
      alert('저장에 실패했습니다. ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black">
      <div className="max-w-4xl mx-auto bg-white p-4 md:p-6 shadow-lg rounded-lg" id="invoice-area">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 border-b pb-2">J-TECH 명세서 시스템</h1>
        
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">거래처명</label>
          <select 
            className="w-full border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-blue-500 bg-white text-base md:text-sm transition shadow-sm" 
            value={selectedClientId} 
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">거래처를 선택하세요 (비활성 숨김 상태)</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>

        {/* =========================================
            모바일 최적화 영역 (화면 크기에 따라 뷰가 다름)
            ========================================= */}

        {/* 1. 데스크탑 뷰 (표 형식 - md 사이즈 이상에서만 보임) */}
        <div className="hidden md:block overflow-x-auto mb-4">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-200">
                <th className="p-3 border-x">품목 선택 (비활성 숨김)</th>
                <th className="p-3 border-x w-24 text-center">수량</th>
                <th className="p-3 border-x w-32 text-right">단가</th>
                <th className="p-3 border-x w-32 text-right">합계</th>
                <th className="p-3 border-x w-16 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="text-sm border-b">
                  <td className="border-x p-2">
                    <select 
                      className="w-full outline-none bg-transparent p-1"
                      value={item.product_id}
                      onChange={(e) => handleProductSelect(idx, e.target.value)}
                    >
                      <option value="">품목을 선택하세요</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} {p.spec ? `(${p.spec})` : ''}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border-x p-2">
                    <input type="number" className="w-full outline-none text-center p-1" 
                      value={item.qty === 0 ? '' : item.qty}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].qty = Number(e.target.value);
                        setItems(newItems);
                      }}
                      placeholder="0"
                    />
                  </td>
                  <td className="border-x p-2">
                    <input type="number" className="w-full outline-none text-right bg-gray-50 p-1" 
                      value={item.price === 0 ? '' : item.price}
                      readOnly
                    />
                  </td>
                  <td className="border-x p-2 text-right font-bold text-gray-700">
                    {(item.qty * item.price).toLocaleString()}원
                  </td>
                  <td className="border-x p-2 text-center">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded">X</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 2. 모바일 뷰 (카드 형식 - md 사이즈 미만에서만 보임) */}
        <div className="md:hidden space-y-4 mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-2">명세서 품목 내역</label>
          {items.map((item, idx) => (
            <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm relative">
              {/* 항목 삭제 버튼 (우측 상단) */}
              {items.length > 1 && (
                <button 
                  onClick={() => removeItem(idx)} 
                  className="absolute top-3 right-3 text-red-500 bg-red-50 w-8 h-8 rounded-full font-bold flex items-center justify-center"
                >
                  X
                </button>
              )}
              
              <div className="mb-3 pr-8">
                <label className="text-xs font-bold text-gray-500 block mb-1">품목 선택 (항목 {idx + 1})</label>
                <select 
                  className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 bg-gray-50 text-base"
                  value={item.product_id}
                  onChange={(e) => handleProductSelect(idx, e.target.value)}
                >
                  <option value="">터치하여 품목 선택</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.spec ? `(${p.spec})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 block mb-1">수량</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 text-center text-base" 
                    value={item.qty === 0 ? '' : item.qty}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].qty = Number(e.target.value);
                      setItems(newItems);
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 block mb-1">단가 (원)</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 outline-none bg-gray-100 text-right text-gray-500 text-base" 
                    value={item.price === 0 ? '' : item.price}
                    readOnly
                  />
                </div>
              </div>

              <div className="text-right border-t border-dashed pt-3 mt-2">
                <span className="text-xs text-gray-500 mr-2">합계금액</span>
                <span className="font-bold text-blue-700 text-lg">{(item.qty * item.price).toLocaleString()}원</span>
              </div>
            </div>
          ))}
        </div>

        {/* ========================================= */}

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 print:hidden border-b pb-6 gap-4">
          {/* 모바일에서는 버튼이 화면 꽉 차게 커집니다 */}
          <button onClick={addItem} className="w-full md:w-auto bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition font-bold shadow">
            + 품목 한 줄 더 추가하기
          </button>
          
          <div className="flex flex-col md:flex-row w-full md:w-auto gap-2 md:space-x-2">
            <button onClick={handleSave} disabled={isSaving} className={`w-full md:w-auto px-6 py-3 rounded-lg text-white font-bold transition shadow ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isSaving ? '저장 중...' : 'DB에 명세서 저장'}
            </button>
            <button onClick={handlePrint} className="w-full md:w-auto bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-bold shadow">
              화면 인쇄 (임시)
            </button>
          </div>
        </div>

        <div className="text-right space-y-2 bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-200">
          <div className="text-gray-600 font-medium">공급가액: <span className="text-black">{supplyTotal.toLocaleString()}원</span></div>
          <div className="text-gray-600 font-medium">부가세: <span className="text-black">{vatTotal.toLocaleString()}원</span></div>
          <div className="text-2xl md:text-3xl font-extrabold pt-3 border-t border-gray-300 mt-2">
            총 청구액: <span className="text-blue-700">{grandTotal.toLocaleString()}원</span>
          </div>
        </div>
      </div>
    </div>
  );
}