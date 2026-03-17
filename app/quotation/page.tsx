"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Client { id: string; name: string; }
interface Product { id: string; name: string; spec: string; price: number; is_vat_included: boolean; }
interface QuotationItem { product_id: string; name: string; spec: string; qty: number; price: number; is_vat_included: boolean; }

export default function QuotationPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([{ product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error: profileError } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        const profile = data as { company_id: string } | null;

        if (profileError || !profile) return;

        const { data: clientsData } = await supabase.from('clients').select('id, name').eq('company_id', profile.company_id).eq('is_active', true).order('name', { ascending: true });
        const { data: productsData } = await supabase.from('products').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('name', { ascending: true });
        
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
    if (!selectedClientId) { alert('거래처를 선택해주세요.'); return; }
    if (items.some(item => !item.name || item.qty <= 0)) { alert('품목명과 수량을 올바르게 입력해주세요.'); return; }

    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인 세션 만료');

      const { data } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      const profile = data as { company_id: string } | null;
      if (!profile) throw new Error("회사 정보 없음");

      // 견적서 번호 규칙: EST-YYYYMMDD-XXXX
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const generatedQuotationNo = `EST-${dateStr}-${randomStr}`;

      // quotations 테이블에 저장 (아까 SQL로 만든 테이블)
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotations')
        .insert([{
          company_id: profile.company_id,
          client_id: selectedClientId,
          quotation_no: generatedQuotationNo,
          supply_amount: supplyTotal,
          vat_amount: vatTotal,
          total_amount: grandTotal
        }])
        .select().single();

      if (quoteError) throw quoteError;

      const itemsToInsert = items.map(item => ({
        quotation_id: quoteData.id,
        product_id: item.product_id || null,
        name: item.name,
        spec: item.spec,
        qty: item.qty,
        price: item.price
      }));

      const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      alert(`견적서가 성공적으로 저장되었습니다. (번호: ${generatedQuotationNo})\n견적내역 관리 메뉴에서 인쇄가 가능합니다.`);
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
      <div className="max-w-4xl mx-auto bg-white p-4 md:p-6 shadow-lg rounded-lg border-t-4 border-yellow-500">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 border-b pb-2 flex items-center">
          <span className="mr-2">📝</span> 견적서 신규 작성
        </h1>
        
        <div className="mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
          <label className="block text-sm font-bold text-gray-700 mb-2">견적 대상 거래처</label>
          <select 
            className="w-full border-2 border-yellow-200 rounded-lg p-3 outline-none focus:border-yellow-500 bg-white text-base md:text-sm" 
            value={selectedClientId} 
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">거래처를 선택하세요</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>

        {/* 데스크탑 뷰 (표 형식) */}
        <div className="hidden md:block overflow-x-auto mb-4">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-200">
                <th className="p-3 border-x">품목 불러오기</th>
                <th className="p-3 border-x">품명 (직접입력)</th>
                <th className="p-3 border-x w-24 text-center">수량</th>
                <th className="p-3 border-x w-32 text-right">단가</th>
                <th className="p-3 border-x w-32 text-right">견적금액</th>
                <th className="p-3 border-x w-16 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="text-sm border-b">
                  <td className="border-x p-2">
                    <select className="w-full outline-none bg-transparent p-1" value={item.product_id} onChange={(e) => handleProductSelect(idx, e.target.value)}>
                      <option value="">품목 선택</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.spec ? `(${p.spec})` : ''}</option>)}
                    </select>
                  </td>
                  <td className="border-x p-2">
                    <input type="text" className="w-full outline-none p-1" value={item.name} onChange={(e) => { const newItems = [...items]; newItems[idx].name = e.target.value; setItems(newItems); }} placeholder="품명 입력" />
                  </td>
                  <td className="border-x p-2">
                    <input type="number" className="w-full outline-none text-center p-1" value={item.qty === 0 ? '' : item.qty} onChange={(e) => { const newItems = [...items]; newItems[idx].qty = Number(e.target.value); setItems(newItems); }} placeholder="0" />
                  </td>
                  <td className="border-x p-2">
                    <input type="number" className="w-full outline-none text-right p-1" value={item.price === 0 ? '' : item.price} onChange={(e) => { const newItems = [...items]; newItems[idx].price = Number(e.target.value); setItems(newItems); }} />
                  </td>
                  <td className="border-x p-2 text-right font-bold text-gray-700">
                    {(item.qty * item.price).toLocaleString()}원
                  </td>
                  <td className="border-x p-2 text-center">
                    {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded">X</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 모바일 뷰 (카드 형식) */}
        <div className="md:hidden space-y-4 mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-2">견적 품목 내역</label>
          {items.map((item, idx) => (
            <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm relative">
              {items.length > 1 && (
                <button onClick={() => removeItem(idx)} className="absolute top-3 right-3 text-red-500 bg-red-50 w-8 h-8 rounded-full font-bold flex items-center justify-center">X</button>
              )}
              <div className="mb-3 pr-8">
                <label className="text-xs font-bold text-gray-500 block mb-1">품목 불러오기 (선택)</label>
                <select className="w-full border rounded-lg p-2.5 outline-none focus:border-yellow-500 bg-gray-50 text-base" value={item.product_id} onChange={(e) => handleProductSelect(idx, e.target.value)}>
                  <option value="">터치하여 품목 선택</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="text-xs font-bold text-gray-500 block mb-1">품명 (직접입력 가능)</label>
                <input type="text" className="w-full border rounded-lg p-2.5 outline-none focus:border-yellow-500 text-base" value={item.name} onChange={(e) => { const newItems = [...items]; newItems[idx].name = e.target.value; setItems(newItems); }} />
              </div>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 block mb-1">수량</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 outline-none focus:border-yellow-500 text-center text-base" value={item.qty === 0 ? '' : item.qty} onChange={(e) => { const newItems = [...items]; newItems[idx].qty = Number(e.target.value); setItems(newItems); }} />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 block mb-1">단가 (원)</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 outline-none focus:border-yellow-500 text-right text-base" value={item.price === 0 ? '' : item.price} onChange={(e) => { const newItems = [...items]; newItems[idx].price = Number(e.target.value); setItems(newItems); }} />
                </div>
              </div>
              <div className="text-right border-t border-dashed pt-3 mt-2">
                <span className="text-xs text-gray-500 mr-2">견적금액</span>
                <span className="font-bold text-yellow-700 text-lg">{(item.qty * item.price).toLocaleString()}원</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b pb-6 gap-4">
          <button onClick={addItem} className="w-full md:w-auto bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition font-bold shadow">
            + 품목 한 줄 더 추가하기
          </button>
          
          <div className="flex w-full md:w-auto gap-2">
            <button onClick={handleSave} disabled={isSaving} className={`w-full px-8 py-3 rounded-lg text-white font-bold transition shadow text-lg ${isSaving ? 'bg-yellow-400' : 'bg-yellow-600 hover:bg-yellow-700'}`}>
              {isSaving ? '저장 중...' : 'DB에 견적서 저장'}
            </button>
          </div>
        </div>

        <div className="text-right space-y-2 bg-yellow-50 p-4 md:p-6 rounded-lg border border-yellow-200">
          <div className="text-gray-600 font-medium">공급가액: <span className="text-black">{supplyTotal.toLocaleString()}원</span></div>
          <div className="text-gray-600 font-medium">부가세: <span className="text-black">{vatTotal.toLocaleString()}원</span></div>
          <div className="text-2xl md:text-3xl font-extrabold pt-3 border-t border-yellow-300 mt-2">
            총 견적금액: <span className="text-yellow-800">{grandTotal.toLocaleString()}원</span>
          </div>
        </div>
      </div>
    </div>
  );
}