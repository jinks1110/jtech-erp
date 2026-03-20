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
  
  // === 거래처 자동완성 검색 상태 ===
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // 외부 클릭 시 검색 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

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
    if (!searchTerm.trim()) {
      showAlert('입력 오류', '거래처명을 검색하여 선택하거나 직접 입력해주세요.');
      return;
    }
    if (items.some(item => !item.name || item.qty <= 0)) { 
      showAlert('입력 오류', '품목명과 수량을 올바르게 입력해주세요.'); 
      return; 
    }

    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인 세션 만료');

      const { data } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      const profile = data as { company_id: string } | null;
      if (!profile) throw new Error("회사 정보 없음");

      let finalClientId = '';
      const existingClient = clients.find(c => c.name === searchTerm.trim());
      
      if (existingClient) {
        finalClientId = existingClient.id; 
      } else {
        const { data: newClient, error: clientErr } = await supabase
          .from('clients')
          .insert([{ company_id: profile.company_id, name: searchTerm.trim(), is_active: true }])
          .select()
          .single();
        if (clientErr) throw clientErr;
        finalClientId = newClient.id;
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const generatedInvoiceNo = `INV-${dateStr}-${randomStr}`;

      const { data: invoiceData, error: invoiceError } = await supabase.from('invoices').insert([{
        company_id: profile.company_id, client_id: finalClientId, invoice_no: generatedInvoiceNo,
        supply_amount: supplyTotal, vat_amount: vatTotal, total_amount: grandTotal
      }]).select().single();
      if (invoiceError) throw invoiceError;

      const itemsToInsert = items.map(item => ({
        invoice_id: invoiceData.id, product_id: item.product_id || null, name: item.name, spec: item.spec, qty: item.qty, price: item.price
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      showAlert('발행 완료', '명세서가 성공적으로 발행되었습니다!\n발행된 명세서 화면으로 이동합니다.', () => {
        closeModal();
        router.push(`/sales/${invoiceData.id}`);
      });

    } catch (error: any) {
      showAlert('저장 실패', '저장에 실패했습니다. ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black relative">
      
      {/* 커스텀 모달 (pt-20 적용) */}
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

      <div className="max-w-5xl mx-auto bg-white p-4 md:p-8 shadow-xl rounded-2xl border-t-4 border-blue-600">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 border-b pb-3 flex items-center">
          <span className="mr-2 text-3xl">✍️</span> 신규 거래명세표 작성
        </h1>
        
        {/* === 거래처 자동완성 검색창 (너비 맞춤 수정 완료) === */}
        <div className="mb-8 bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm">
          <label className="block text-sm font-bold text-gray-700 mb-2">거래처 검색 (일부만 입력해도 찾아줍니다)</label>
          <div className="relative w-full" ref={wrapperRef}>
            <input
              type="text"
              className="w-full border-2 border-blue-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-600 bg-white text-base md:text-sm font-bold shadow-inner transition"
              placeholder="🔍 예: 삼덕전기"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onClick={() => setShowDropdown(true)}
            />
            
            {/* 드롭다운 너비를 w-full로 고정하여 입력창과 완벽 일치 */}
            {showDropdown && filteredClients.length > 0 && (
              <ul className="absolute z-20 w-full left-0 mt-1 bg-white border-2 border-blue-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {filteredClients.map(client => (
                  <li
                    key={client.id}
                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition flex justify-between items-center"
                    onClick={() => {
                      setSearchTerm(client.name);
                      setShowDropdown(false);
                    }}
                  >
                    <span className="font-bold text-gray-800">{client.name}</span>
                    <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded">{client.business_number || '사업자번호 없음'}</span>
                  </li>
                ))}
              </ul>
            )}
            {showDropdown && searchTerm && filteredClients.length === 0 && (
              <div className="absolute z-20 w-full left-0 mt-1 bg-white border-2 border-yellow-200 rounded-lg shadow-xl p-4 text-center">
                <p className="text-sm font-bold text-gray-600">검색된 거래처가 없습니다.</p>
                <p className="text-xs text-yellow-600 mt-1">이대로 저장하시면 '{searchTerm}' 이름으로 새 거래처가 등록됩니다.</p>
              </div>
            )}
          </div>
          <p className="text-xs text-blue-600 mt-2 font-bold">
            * 초성이나 단어 일부만 치시면 목록이 나타납니다. (기존 이름과 똑같이 치면 중복 등록되지 않습니다.)
          </p>
        </div>

        {/* === 데스크탑 뷰 (견적서 폼과 100% 동일하게 복구) === */}
        <div className="hidden md:block overflow-x-auto mb-6 shadow-sm rounded-lg border border-gray-200">
          <table className="w-full border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-300">
                <th className="p-3 border-r">품목 불러오기</th>
                <th className="p-3 border-r w-48">품명 <span className="text-blue-600 text-xs">(직접입력 가능)</span></th>
                <th className="p-3 border-r w-24 text-center">수량</th>
                <th className="p-3 border-r w-32 text-right">단가</th>
                <th className="p-3 border-r w-32 text-right">공급가액</th>
                <th className="p-3 w-28 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="text-sm border-b bg-white hover:bg-gray-50 transition">
                  <td className="border-r p-2">
                    <select className="w-full outline-none bg-transparent p-1 cursor-pointer" value={item.product_id} onChange={(e) => handleProductSelect(idx, e.target.value)}>
                      <option value="">직접 입력</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.spec ? `(${p.spec})` : ''}</option>)}
                    </select>
                  </td>
                  <td className="border-r p-2">
                    <input type="text" className="w-full outline-none p-1 bg-transparent font-bold placeholder-gray-300" value={item.name} onChange={(e) => { const newItems = [...items]; newItems[idx].name = e.target.value; setItems(newItems); }} placeholder="품명 직접 타자" />
                  </td>
                  <td className="border-r p-2">
                    <input type="number" className="w-full outline-none text-center p-1 bg-transparent font-medium" value={item.qty === 0 ? '' : item.qty} onChange={(e) => { const newItems = [...items]; newItems[idx].qty = Number(e.target.value); setItems(newItems); }} placeholder="0" />
                  </td>
                  <td className="border-r p-2">
                    <input type="number" className="w-full outline-none text-right p-1 bg-transparent font-medium" value={item.price === 0 ? '' : item.price} onChange={(e) => { const newItems = [...items]; newItems[idx].price = Number(e.target.value); setItems(newItems); }} placeholder="0" />
                  </td>
                  <td className="border-r p-2 text-right font-bold text-gray-700">
                    {(item.qty * item.price).toLocaleString()}원
                  </td>
                  <td className="p-2 text-center space-x-1 whitespace-nowrap">
                    <button onClick={() => copyItem(idx)} className="text-purple-600 font-bold hover:bg-purple-50 px-2 py-1 rounded transition text-xs border border-purple-200 bg-white">복사</button>
                    {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded transition text-xs border border-red-200 bg-white">삭제</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* === 모바일 뷰 (견적서 폼과 100% 동일하게 복구) === */}
        <div className="md:hidden space-y-4 mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">명세서 품목 내역</label>
          {items.map((item, idx) => (
            <div key={idx} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm relative">
              <div className="absolute top-3 right-3 flex gap-2">
                <button onClick={() => copyItem(idx)} className="text-purple-600 bg-purple-50 px-3 py-1 rounded-full font-bold flex items-center justify-center shadow-sm border border-purple-100 text-xs">
                  복사
                </button>
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-red-500 bg-red-50 w-7 h-7 rounded-full font-bold flex items-center justify-center shadow-sm border border-red-100 text-xs">
                    X
                  </button>
                )}
              </div>
              
              <div className="mb-3 pr-24">
                <label className="text-xs font-bold text-gray-500 block mb-1">품목 불러오기 (선택)</label>
                <select className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 bg-gray-50 text-base" value={item.product_id} onChange={(e) => handleProductSelect(idx, e.target.value)}>
                  <option value="">직접 입력하기 (선택 안함)</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="text-xs font-bold text-blue-600 block mb-1">품명 (직접입력)</label>
                <input type="text" className="w-full border border-blue-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-base font-bold placeholder-gray-300 shadow-inner" placeholder="품명을 직접 타자하세요" value={item.name} onChange={(e) => { const newItems = [...items]; newItems[idx].name = e.target.value; setItems(newItems); }} />
              </div>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 block mb-1">수량</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 text-center text-base font-medium bg-gray-50" value={item.qty === 0 ? '' : item.qty} onChange={(e) => { const newItems = [...items]; newItems[idx].qty = Number(e.target.value); setItems(newItems); }} placeholder="0" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 block mb-1">단가 (원)</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 text-right text-base font-medium bg-gray-50" value={item.price === 0 ? '' : item.price} onChange={(e) => { const newItems = [...items]; newItems[idx].price = Number(e.target.value); setItems(newItems); }} placeholder="0" />
                </div>
              </div>
              <div className="text-right border-t border-dashed border-gray-300 pt-3 mt-2">
                <span className="text-xs text-gray-500 mr-2">공급가액</span>
                <span className="font-bold text-blue-700 text-lg">{(item.qty * item.price).toLocaleString()}원</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-200 pb-6 gap-4">
          <button onClick={addItem} className="w-full md:w-auto bg-gray-800 text-white px-6 py-3 md:py-2.5 rounded-lg hover:bg-gray-700 transition font-bold shadow-md">
            + 빈 품목 줄 추가
          </button>
        </div>

        <div className="flex flex-col md:flex-row justify-end items-end md:items-center gap-6 bg-gray-50 p-5 md:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full md:w-auto text-right md:text-left">
            <div>
              <p className="text-sm font-bold text-gray-500 mb-1">공급가액</p>
              <p className="text-xl font-bold text-gray-800">{supplyTotal.toLocaleString()}원</p>
            </div>
            <div className="hidden md:block w-px bg-gray-300"></div>
            <div>
              <p className="text-sm font-bold text-gray-500 mb-1">부가세</p>
              <p className="text-xl font-bold text-gray-800">{vatTotal.toLocaleString()}원</p>
            </div>
          </div>
          
          <div className="w-full md:w-auto border-t md:border-none border-gray-300 pt-4 md:pt-0 pl-0 md:pl-8 text-right">
            <p className="text-sm font-bold text-blue-600 mb-1">총 합계금액</p>
            <p className="text-3xl md:text-4xl font-extrabold text-black tracking-tight">{grandTotal.toLocaleString()}원</p>
          </div>
        </div>

        <div className="mt-8">
          <button onClick={handleSave} disabled={isSaving} className={`w-full py-4 rounded-xl text-white font-extrabold transition shadow-lg text-lg ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1'}`}>
            {isSaving ? '명세서 생성 중...' : '명세서 발행 및 저장하기'}
          </button>
        </div>

      </div>
    </div>
  );
}