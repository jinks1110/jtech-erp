"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Client { id: string; name: string; }
interface Product { id: string; name: string; spec: string; price: number; is_vat_included: boolean; }
interface QuotationItem { product_id: string; name: string; spec: string; qty: number; price: number; is_vat_included: boolean; }

export default function QuotationPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([{ product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);
  const [isSaving, setIsSaving] = useState(false);

  // === 커스텀 모달창 상태 관리 ===
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', desc: '', isAlert: true,
    confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700',
    onConfirm: () => {}
  });

  const closeModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const showAlert = (title: string, desc: string, onConfirm = closeModal) => {
    setConfirmModal({
      isOpen: true, title, desc, isAlert: true,
      confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        const profile = data as { company_id: string } | null;
        if (!profile) return;

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
    const newItems = [...items]; newItems.splice(index, 1); setItems(newItems);
  };
  const copyItem = (index: number) => {
    const itemToCopy = items[index];
    const newItems = [...items]; newItems.splice(index + 1, 0, { ...itemToCopy }); setItems(newItems);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const selectedProduct = products.find(p => p.id === productId);
    const newItems = [...items];
    if (selectedProduct) {
      newItems[index] = {
        product_id: selectedProduct.id, name: selectedProduct.name, spec: selectedProduct.spec || '',
        qty: newItems[index].qty === 0 ? 1 : newItems[index].qty, price: selectedProduct.price, is_vat_included: selectedProduct.is_vat_included
      };
    } else {
      newItems[index] = { product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false };
    }
    setItems(newItems);
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
    if (!selectedClientId) { showAlert('입력 오류', '거래처를 선택해주세요.'); return; }
    if (items.some(item => !item.name || item.qty <= 0)) { showAlert('입력 오류', '품목명과 수량을 올바르게 입력해주세요.'); return; }

    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인 세션 만료');

      const { data } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      const profile = data as { company_id: string } | null;
      if (!profile) throw new Error("회사 정보 없음");

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const generatedQuotationNo = `EST-${dateStr}-${randomStr}`;

      const { data: quoteData, error: quoteError } = await supabase.from('quotations').insert([{
        company_id: profile.company_id, client_id: selectedClientId, quotation_no: generatedQuotationNo,
        supply_amount: supplyTotal, vat_amount: vatTotal, total_amount: grandTotal
      }]).select().single();
      if (quoteError) throw quoteError;

      const itemsToInsert = items.map(item => ({
        quotation_id: quoteData.id, product_id: item.product_id || null, name: item.name, spec: item.spec, qty: item.qty, price: item.price
      }));

      const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      showAlert('발행 완료', '견적서가 성공적으로 발행되었습니다!\n발행된 견적서 화면으로 이동합니다.', () => {
        closeModal();
        router.push(`/quotation/${quoteData.id}`);
      });
    } catch (error: any) {
      showAlert('저장 실패', '저장에 실패했습니다. ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black relative">
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 print:hidden">
          <div className="absolute inset-0 bg-transparent" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border-2 border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 whitespace-pre-line text-sm leading-relaxed">{confirmModal.desc}</p>
            <div className="flex justify-end gap-3">
              {!confirmModal.isAlert && <button onClick={closeModal} className="px-4 py-2 rounded-lg font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">취소</button>}
              <button onClick={confirmModal.onConfirm} className={`px-4 py-2 rounded-lg font-bold text-white transition shadow-md ${confirmModal.confirmColor}`}>{confirmModal.confirmText}</button>
            </div>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }` }} />

      <div className="max-w-5xl mx-auto bg-white p-4 md:p-8 shadow-xl rounded-2xl border-t-4 border-yellow-500">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 border-b pb-3 flex items-center"><span className="mr-2 text-3xl">✍️</span> 신규 견적서 작성</h1>
        
        <div className="mb-8 bg-yellow-50 p-5 rounded-xl border border-yellow-100 shadow-sm">
          <label className="block text-sm font-bold text-gray-700 mb-2">거래처 선택</label>
          <select className="w-full border-2 border-yellow-200 rounded-lg p-3 outline-none focus:border-yellow-500 bg-white text-base md:text-sm font-medium shadow-sm transition" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            <option value="">거래처를 선택하세요</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </div>

        <div className="hidden md:block overflow-x-auto mb-6 shadow-sm rounded-lg border border-gray-200">
          <table className="w-full border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-300">
                <th className="p-3 border-r">품목 불러오기</th><th className="p-3 border-r w-48">품명 <span className="text-yellow-600 text-xs">(직접입력 가능)</span></th>
                <th className="p-3 border-r w-24 text-center">수량</th><th className="p-3 border-r w-32 text-right">단가</th>
                <th className="p-3 border-r w-32 text-right">금액</th><th className="p-3 w-28 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="text-sm border-b bg-white hover:bg-gray-50 transition">
                  <td className="border-r p-2"><select className="w-full outline-none bg-transparent p-1 cursor-pointer" value={item.product_id} onChange={(e) => handleProductSelect(idx, e.target.value)}><option value="">직접 입력</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} {p.spec ? `(${p.spec})` : ''}</option>)}</select></td>
                  <td className="border-r p-2"><input type="text" className="w-full outline-none p-1 bg-transparent font-bold placeholder-gray-300" value={item.name} onChange={(e) => { const newItems = [...items]; newItems[idx].name = e.target.value; setItems(newItems); }} placeholder="품명 직접 타자" /></td>
                  <td className="border-r p-2"><input type="number" className="w-full outline-none text-center p-1 bg-transparent font-medium" value={item.qty === 0 ? '' : item.qty} onChange={(e) => { const newItems = [...items]; newItems[idx].qty = Number(e.target.value); setItems(newItems); }} placeholder="0" /></td>
                  <td className="border-r p-2"><input type="number" className="w-full outline-none text-right p-1 bg-transparent font-medium" value={item.price === 0 ? '' : item.price} onChange={(e) => { const newItems = [...items]; newItems[idx].price = Number(e.target.value); setItems(newItems); }} placeholder="0" /></td>
                  <td className="border-r p-2 text-right font-bold text-gray-700">{(item.qty * item.price).toLocaleString()}원</td>
                  <td className="p-2 text-center space-x-1 whitespace-nowrap">
                    <button onClick={() => copyItem(idx)} className="text-purple-600 font-bold hover:bg-purple-50 px-2 py-1 rounded transition text-xs border border-purple-200 bg-white">복사</button>
                    {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded transition text-xs border border-red-200 bg-white">삭제</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4 mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">견적서 품목 내역</label>
          {items.map((item, idx) => (
            <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm relative">
              <div className="absolute top-3 right-3 flex gap-2">
                <button onClick={() => copyItem(idx)} className="text-purple-600 bg-purple-50 px-3 py-1 rounded-full font-bold flex items-center justify-center shadow-sm border border-purple-100 text-xs">복사</button>
                {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-500 bg-red-50 w-7 h-7 rounded-full font-bold flex items-center justify-center shadow-sm border border-red-100 text-xs">X</button>}
              </div>
              <div className="mb-3 pr-24"><label className="text-xs font-bold text-gray-500 block mb-1">품목 불러오기 (선택)</label><select className="w-full border rounded-lg p-2.5 outline-none focus:border-yellow-500 bg-gray-50 text-base" value={item.product_id} onChange={(e) => handleProductSelect(idx, e.target.value)}><option value="">직접 입력하기</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="mb-3"><label className="text-xs font-bold text-yellow-600 block mb-1">품명 (직접입력)</label><input type="text" className="w-full border border-yellow-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-yellow-500 text-base font-bold placeholder-gray-300 shadow-inner" placeholder="품명을 직접 타자하세요" value={item.name} onChange={(e) => { const newItems = [...items]; newItems[idx].name = e.target.value; setItems(newItems); }} /></div>
              <div className="flex gap-3 mb-3">
                <div className="flex-1"><label className="text-xs font-bold text-gray-500 block mb-1">수량</label><input type="number" className="w-full border rounded-lg p-2.5 outline-none focus:border-yellow-500 text-center text-base font-medium bg-gray-50" value={item.qty === 0 ? '' : item.qty} onChange={(e) => { const newItems = [...items]; newItems[idx].qty = Number(e.target.value); setItems(newItems); }} placeholder="0" /></div>
                <div className="flex-1"><label className="text-xs font-bold text-gray-500 block mb-1">단가 (원)</label><input type="number" className="w-full border rounded-lg p-2.5 outline-none focus:border-yellow-500 text-right text-base font-medium bg-gray-50" value={item.price === 0 ? '' : item.price} onChange={(e) => { const newItems = [...items]; newItems[idx].price = Number(e.target.value); setItems(newItems); }} placeholder="0" /></div>
              </div>
              <div className="text-right border-t border-dashed border-gray-300 pt-3 mt-2"><span className="text-xs text-gray-500 mr-2">금액</span><span className="font-bold text-yellow-700 text-lg">{(item.qty * item.price).toLocaleString()}원</span></div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-200 pb-6 gap-4">
          <button onClick={addItem} className="w-full md:w-auto bg-gray-800 text-white px-6 py-3 md:py-2.5 rounded-lg hover:bg-gray-700 transition font-bold shadow-md">+ 빈 품목 줄 추가</button>
        </div>

        <div className="flex flex-col md:flex-row justify-end items-end md:items-center gap-6 bg-gray-50 p-5 md:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full md:w-auto text-right md:text-left">
            <div><p className="text-sm font-bold text-gray-500 mb-1">견적 공급가액</p><p className="text-xl font-bold text-gray-800">{supplyTotal.toLocaleString()}원</p></div>
            <div className="hidden md:block w-px bg-gray-300"></div>
            <div><p className="text-sm font-bold text-gray-500 mb-1">견적 부가세</p><p className="text-xl font-bold text-gray-800">{vatTotal.toLocaleString()}원</p></div>
          </div>
          <div className="w-full md:w-auto border-t md:border-none border-gray-300 pt-4 md:pt-0 pl-0 md:pl-8 text-right">
            <p className="text-sm font-bold text-yellow-600 mb-1">총 견적액</p><p className="text-3xl md:text-4xl font-extrabold text-black tracking-tight">{grandTotal.toLocaleString()}원</p>
          </div>
        </div>

        <div className="mt-8">
          <button onClick={handleSave} disabled={isSaving} className={`w-full py-4 rounded-xl text-white font-extrabold transition shadow-lg text-lg ${isSaving ? 'bg-yellow-400 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600 hover:-translate-y-1'}`}>
            {isSaving ? '견적서 생성 중...' : '견적서 발행 및 저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}