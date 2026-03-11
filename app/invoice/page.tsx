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

        // TS 문법 오류 해결: data의 타입을 명확히 지정하여 의심을 없앰
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

      // TS 문법 오류 해결: 저장할 때도 profile의 타입을 명확하게 지정
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
          company_id: profile.company_id, // 이제 여기서 빨간 줄이 절대 뜨지 않습니다!
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
      <div className="max-w-4xl mx-auto bg-white p-6 shadow-lg rounded-lg" id="invoice-area">
        <h1 className="text-2xl font-bold mb-6 border-b pb-2">J-TECH 명세서 시스템</h1>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">거래처명</label>
          <select 
            className="w-full border rounded p-2 outline-none focus:border-blue-500 bg-white" 
            value={selectedClientId} 
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">거래처를 선택하세요 (비활성 숨김 상태)</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full mb-4 border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-100 text-left text-sm">
                <th className="p-2 border">품목 선택 (비활성 숨김)</th>
                <th className="p-2 border w-24">수량</th>
                <th className="p-2 border w-32 text-right">단가</th>
                <th className="p-2 border w-32 text-right">합계</th>
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
                      value={item.qty === 0 ? '' : item.qty}
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
                      value={item.price === 0 ? '' : item.price}
                      readOnly
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

        <div className="flex justify-between items-center mb-6 print:hidden border-b pb-6">
          <button onClick={addItem} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition text-sm">
            + 품목 줄 추가
          </button>
          
          <div className="space-x-2">
            <button onClick={handleSave} disabled={isSaving} className={`px-4 py-2 rounded text-white font-bold transition text-sm ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isSaving ? '저장 중...' : 'DB에 명세서 저장'}
            </button>
            {/* 여기 인쇄 버튼은 엑셀이나 임시 출력용이므로 그대로 둡니다 */}
            <button onClick={handlePrint} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition font-bold text-sm">
              화면 인쇄 (임시)
            </button>
          </div>
        </div>

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