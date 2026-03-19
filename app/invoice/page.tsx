"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Client { id: string; name: string; business_number: string; }
interface Product { id: string; name: string; spec: string; price: number; is_vat_included: boolean; }
interface InvoiceItem { product_id: string; name: string; spec: string; qty: number; price: number; is_vat_included: boolean; }

export default function InvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // 거래처 검색 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 품목 검색 상태 (각 줄마다 관리)
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
  const [itemSearchTerms, setItemSearchTerms] = useState<string[]>(['']);
  const itemWrapperRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<InvoiceItem[]>([{ product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', desc: '', isAlert: true, confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm: () => {}
  });

  const closeModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, desc: string, onConfirm = closeModal) => {
    setConfirmModal({ isOpen: true, title, desc, isAlert: true, confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        const profile = data as { company_id: string } | null;
        if (!profile) return;

        const { data: clientsData } = await supabase.from('clients').select('id, name, business_number').eq('company_id', profile.company_id).eq('is_active', true).order('name', { ascending: true });
        const { data: productsData } = await supabase.from('products').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('name', { ascending: true });
        
        if (clientsData) setClients(clientsData);
        if (productsData) setProducts(productsData);
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setShowDropdown(false);
      if (itemWrapperRef.current && !itemWrapperRef.current.contains(event.target as Node)) setActiveItemIdx(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const addItem = () => {
    setItems([...items, { product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);
    setItemSearchTerms([...itemSearchTerms, '']);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    const newItems = [...items]; newItems.splice(index, 1); setItems(newItems);
    const newSearch = [...itemSearchTerms]; newSearch.splice(index, 1); setItemSearchTerms(newSearch);
  };

  const copyItem = (index: number) => {
    setItems([...items.slice(0, index + 1), { ...items[index] }, ...items.slice(index + 1)]);
    setItemSearchTerms([...itemSearchTerms.slice(0, index + 1), itemSearchTerms[index], ...itemSearchTerms.slice(index + 1)]);
  };

  const selectProduct = (index: number, product: Product) => {
    const newItems = [...items];
    newItems[index] = {
      product_id: product.id, name: product.name, spec: product.spec || '',
      qty: newItems[index].qty === 0 ? 1 : newItems[index].qty, price: product.price, is_vat_included: product.is_vat_included
    };
    setItems(newItems);
    
    const newSearch = [...itemSearchTerms];
    newSearch[index] = product.name;
    setItemSearchTerms(newSearch);
    setActiveItemIdx(null);
  };

  let supplyTotal = 0; let vatTotal = 0;
  items.forEach(item => {
    const lineTotal = item.qty * item.price;
    if (item.is_vat_included) {
      const supply = Math.round(lineTotal / 1.1); supplyTotal += supply; vatTotal += (lineTotal - supply);
    } else {
      supplyTotal += lineTotal; vatTotal += Math.round(lineTotal * 0.1);
    }
  });
  const grandTotal = supplyTotal + vatTotal;

  const handleSave = async () => {
    if (!searchTerm.trim()) { showAlert('입력 오류', '거래처명을 입력해주세요.'); return; }
    if (items.some(item => !item.name || item.qty <= 0)) { showAlert('입력 오류', '품목명과 수량을 올바르게 입력해주세요.'); return; }

    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session!.user.id).single();

      let finalClientId = '';
      const existingClient = clients.find(c => c.name === searchTerm.trim());
      if (existingClient) finalClientId = existingClient.id;
      else {
        const { data: newClient } = await supabase.from('clients').insert([{ company_id: profile!.company_id, name: searchTerm.trim(), is_active: true }]).select().single();
        finalClientId = newClient.id;
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const generatedInvoiceNo = `INV-${dateStr}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      const { data: invoiceData } = await supabase.from('invoices').insert([{
        company_id: profile!.company_id, client_id: finalClientId, invoice_no: generatedInvoiceNo,
        supply_amount: supplyTotal, vat_amount: vatTotal, total_amount: grandTotal
      }]).select().single();

      await supabase.from('invoice_items').insert(items.map(item => ({
        invoice_id: invoiceData.id, product_id: item.product_id || null, name: item.name, spec: item.spec, qty: item.qty, price: item.price
      })));

      showAlert('발행 완료', '명세서가 저장되었습니다.', () => { closeModal(); router.push(`/sales/${invoiceData.id}`); });
    } catch (error) { showAlert('저장 실패', '오류가 발생했습니다.'); } finally { setIsSaving(false); }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black relative">
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 print:hidden">
          <div className="absolute inset-0 bg-transparent" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border-2 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-bold mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 text-sm">{confirmModal.desc}</p>
            <div className="flex justify-end"><button onClick={confirmModal.onConfirm} className="px-4 py-2 rounded-lg font-bold text-white bg-blue-600">확인</button></div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto bg-white p-6 shadow-xl rounded-2xl border-t-4 border-blue-600">
        <h1 className="text-2xl font-bold mb-6">✍️ 신규 거래명세표 작성</h1>
        
        {/* 거래처 검색 */}
        <div className="mb-8 bg-blue-50 p-5 rounded-xl border border-blue-100" ref={wrapperRef}>
          <label className="block text-sm font-bold mb-2 text-gray-700">거래처 검색</label>
          <input type="text" className="w-full border-2 border-blue-300 rounded-lg p-3 font-bold" placeholder="🔍 거래처명 입력" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }} onClick={() => setShowDropdown(true)} />
          {showDropdown && filteredClients.length > 0 && (
            <ul className="absolute z-20 w-[calc(100%-3rem)] md:w-[480px] bg-white border-2 border-blue-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {filteredClients.map(c => <li key={c.id} className="px-4 py-3 hover:bg-blue-50 cursor-pointer font-bold border-b" onClick={() => { setSearchTerm(c.name); setShowDropdown(false); }}>{c.name}</li>)}
            </ul>
          )}
        </div>

        {/* 품목 테이블 (데스크탑) */}
        <div className="hidden md:block overflow-visible mb-6" ref={itemWrapperRef}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-sm border-b-2">
                <th className="p-3 border-r w-64 text-left">품명 (검색/입력)</th>
                <th className="p-3 border-r w-24 text-center">수량</th>
                <th className="p-3 border-r w-32 text-right">단가</th>
                <th className="p-3 border-r w-32 text-right">공급가액</th>
                <th className="p-3 text-center w-24">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="text-sm border-b relative">
                  <td className="p-2 border-r relative">
                    <input type="text" className="w-full outline-none p-1 font-bold" value={item.name} 
                      onChange={(e) => {
                        const newItems = [...items]; newItems[idx].name = e.target.value; setItems(newItems);
                        setActiveItemIdx(idx);
                      }} 
                      onFocus={() => setActiveItemIdx(idx)}
                      placeholder="품명 검색..." 
                    />
                    {activeItemIdx === idx && (
                      <ul className="absolute left-0 top-full z-30 w-full bg-white border-2 border-blue-200 shadow-xl max-h-48 overflow-y-auto">
                        {products.filter(p => p.name.includes(item.name)).map(p => (
                          <li key={p.id} className="p-2 hover:bg-blue-50 cursor-pointer border-b text-xs font-bold" onClick={() => selectProduct(idx, p)}>
                            {p.name} <span className="text-gray-400">({p.spec || '규격없음'})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="p-2 border-r"><input type="number" className="w-full text-center outline-none" value={item.qty || ''} onChange={(e) => { const newItems = [...items]; newItems[idx].qty = Number(e.target.value); setItems(newItems); }} /></td>
                  <td className="p-2 border-r"><input type="number" className="w-full text-right outline-none" value={item.price || ''} onChange={(e) => { const newItems = [...items]; newItems[idx].price = Number(e.target.value); setItems(newItems); }} /></td>
                  <td className="p-2 border-r text-right font-bold">{(item.qty * item.price).toLocaleString()}원</td>
                  <td className="p-2 text-center space-x-1">
                    <button onClick={() => copyItem(idx)} className="text-purple-600 font-bold border px-2 py-1 rounded text-xs">복사</button>
                    <button onClick={() => removeItem(idx)} className="text-red-500 font-bold border px-2 py-1 rounded text-xs">X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={addItem} className="w-full md:w-auto bg-gray-800 text-white px-6 py-2.5 rounded-lg font-bold mb-8">+ 품목 추가</button>

        <div className="bg-gray-50 p-6 rounded-xl border flex flex-col md:flex-row justify-end items-end md:items-center gap-8">
          <div className="text-right">
            <p className="text-sm font-bold text-gray-500">총 공급가액</p>
            <p className="text-xl font-bold">{supplyTotal.toLocaleString()}원</p>
          </div>
          <div className="text-right border-t md:border-t-0 md:border-l pl-0 md:pl-8 pt-4 md:pt-0">
            <p className="text-sm font-bold text-blue-600">최종 합계</p>
            <p className="text-3xl font-extrabold">{grandTotal.toLocaleString()}원</p>
          </div>
        </div>

        <button onClick={handleSave} disabled={isSaving} className="w-full py-4 mt-8 bg-blue-600 text-white font-extrabold rounded-xl shadow-lg">
          {isSaving ? '저장 중...' : '명세서 발행 및 저장하기'}
        </button>
      </div>
    </div>
  );
}