"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Client { id: string; name: string; }
interface Product { id: string; name: string; spec: string; price: number; is_vat_included: boolean; client_id: string; }
interface QuotationItem { id: string; product_id: string; name: string; spec: string; qty: number; price: number; is_vat_included: boolean; }

export default function QuotationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const getTodayKST = () => {
    const offset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - offset).toISOString().slice(0, 10);
  };
  const [quoteDate, setQuoteDate] = useState(getTodayKST());
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [items, setItems] = useState<QuotationItem[]>([{ id: Date.now().toString(), product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', desc: '', confirmText: '확인', confirmColor: 'bg-yellow-500 hover:bg-yellow-600', onConfirm: () => {} });

  const closeModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, desc: string, onConfirm = closeModal) => { setConfirmModal({ isOpen: true, title, desc, confirmText: '확인', confirmColor: 'bg-yellow-500 hover:bg-yellow-600', onConfirm }); };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return router.push('/login');

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        if (!profile) return;

        const { data: clientsData } = await supabase.from('clients').select('id, name').eq('company_id', profile.company_id).eq('is_active', true).order('name', { ascending: true });
        const { data: productsData } = await supabase.from('products').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('name', { ascending: true });
        
        if (clientsData) setClients(clientsData);
        if (productsData) setProducts(productsData);
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowClientDropdown(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()));
  const filteredProducts = selectedClient ? products.filter(p => p.client_id === selectedClient.id) : []; 

  const handleClientSelect = (client: Client) => { setSelectedClient(client); setClientSearchTerm(client.name); setShowClientDropdown(false); setHighlightedIndex(-1); };
  const handleClientSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => { setClientSearchTerm(e.target.value); setShowClientDropdown(true); setHighlightedIndex(-1); if (e.target.value !== selectedClient?.name) setSelectedClient(null); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showClientDropdown || filteredClients.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev < filteredClients.length - 1 ? prev + 1 : prev)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < filteredClients.length) handleClientSelect(filteredClients[highlightedIndex]); }
    else if (e.key === 'Escape') { setShowClientDropdown(false); setHighlightedIndex(-1); }
  };

  const addItem = () => setItems([...items, { id: Date.now().toString(), product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);
  const copyItem = (index: number) => { const itemToCopy = items[index]; const newItems = [...items]; newItems.splice(index + 1, 0, { ...itemToCopy, id: Date.now().toString() }); setItems(newItems); };
  const removeItem = (id: string) => { if (items.length === 1) return setItems([{ id: Date.now().toString(), product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]); setItems(items.filter(item => item.id !== id)); };

  const handleItemChange = (index: number, field: keyof QuotationItem, value: string | number | boolean) => {
    const newItems = [...items];
    if (field === 'product_id') {
      if (value === '') { newItems[index] = { ...newItems[index], product_id: '', name: '', spec: '', price: 0, is_vat_included: false }; }
      else {
        const selectedProd = products.find(p => p.id === value);
        if (selectedProd) { newItems[index] = { ...newItems[index], product_id: selectedProd.id, name: selectedProd.name, spec: selectedProd.spec || '', price: selectedProd.price, is_vat_included: selectedProd.is_vat_included }; }
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
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
    if (!selectedClient) return showAlert('입력 오류', '거래처를 먼저 검색하여 선택해주세요.');
    const validItems = items.filter(item => item.name.trim() !== '' && item.qty > 0);
    if (validItems.length === 0) return showAlert('입력 오류', '최소 1개 이상의 유효한 품목(수량 1 이상)을 입력해주세요.');

    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session!.user.id).single();

      const dateStr = quoteDate.replace(/-/g, '');
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const generatedQuotationNo = `EST-${dateStr}-${randomStr}`;

      const { data: quoteData, error: quoteError } = await supabase.from('quotations').insert([{
        company_id: profile!.company_id, client_id: selectedClient.id, quotation_no: generatedQuotationNo,
        created_at: `${quoteDate}T09:00:00Z`,
        supply_amount: supplyTotal, vat_amount: vatTotal, total_amount: grandTotal
      }]).select().single();
      if (quoteError) throw quoteError;

      const itemsToInsert = validItems.map(item => ({
        quotation_id: quoteData.id, product_id: item.product_id || null, name: item.name, spec: item.spec, qty: item.qty, price: item.price
      }));

      const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      showAlert('발행 완료', '견적서가 성공적으로 발행되었습니다.', () => { closeModal(); router.push(`/quotation-list`); });
    } catch (error: any) {
      showAlert('저장 실패', '저장에 실패했습니다. ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const calendarBlanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">로딩 중...</div>;

  return (
    <div className="w-full overflow-x-hidden min-h-screen bg-gray-50 p-2 pt-16 lg:p-4 lg:pt-8 text-black relative">
      
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4">
          <div className="absolute inset-0 bg-gray-900/10 backdrop-blur-[2px]" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 font-medium text-sm whitespace-pre-line">{confirmModal.desc}</p>
            <div className="flex justify-end"><button onClick={confirmModal.onConfirm} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-5 rounded-lg shadow-md transition">확인</button></div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } 
        .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
      ` }} />

      <div className="max-w-[95%] xl:max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* === 좌측 패널: 거래처 설정 및 달력 === */}
        <div className="w-full lg:w-1/4 space-y-4 shrink-0">
          <div className="bg-white p-5 md:p-6 shadow-lg rounded-xl border-t-4 border-yellow-500 lg:sticky lg:top-6">
            <div className="mb-6 border-b pb-4"><h1 className="text-xl md:text-2xl font-extrabold">견적서 작성</h1><p className="text-gray-500 text-sm mt-1 font-bold">신규 견적서 발행</p></div>

            <div className="relative" ref={searchRef}>
              <label className="block text-sm font-bold text-gray-700 mb-2">1. 거래처 검색</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 font-bold">🔍</span>
                <input type="text" value={clientSearchTerm} onChange={handleClientSearchChange} onClick={() => setShowClientDropdown(true)} onKeyDown={handleKeyDown} className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-yellow-200 focus:border-yellow-500 outline-none font-bold text-gray-800 bg-white" placeholder="예: 삼덕전기" />
              </div>
              {showClientDropdown && filteredClients.length > 0 && (
                <ul className="absolute z-20 w-full left-0 mt-1 bg-white border-2 border-yellow-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredClients.map((client, index) => (
                    <li key={client.id} className={`px-4 py-3 cursor-pointer font-extrabold text-yellow-900 border-b border-gray-100 last:border-b-0 ${highlightedIndex === index ? 'bg-yellow-100' : 'hover:bg-yellow-50'}`} onClick={() => handleClientSelect(client)} onMouseEnter={() => setHighlightedIndex(index)}>{client.name}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className={`mt-3 mb-6 p-4 rounded-lg border-2 transition-all ${selectedClient ? 'bg-yellow-50 border-yellow-400' : 'bg-gray-50 border-dashed border-gray-300'}`}>
              <p className="text-xs font-bold text-gray-500 mb-1">선택된 거래처</p>
              {selectedClient ? (<div className="flex items-center gap-2"><span className="text-xl">🏢</span><span className="text-lg font-extrabold text-yellow-800">{selectedClient.name}</span></div>) : (<p className="text-sm font-bold text-gray-400">거래처를 먼저 선택해주세요.</p>)}
            </div>

            <div className="h-px bg-gray-200 my-4"></div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-bold text-gray-700">2. 견적서 작성 일자</label>
                <input type="date" value={quoteDate} onChange={(e) => { setQuoteDate(e.target.value); setCalendarMonth(new Date(e.target.value)); }} className="border border-gray-300 rounded px-2 py-1 text-sm font-bold outline-none focus:border-yellow-500 text-yellow-700"/>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-inner">
                <div className="flex justify-between items-center mb-4">
                  <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-2 font-bold text-gray-500 hover:text-yellow-600 hover:bg-white rounded-lg">&lt;</button>
                  <span className="font-extrabold text-yellow-900 text-lg">{calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월</span>
                  <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-2 font-bold text-gray-500 hover:text-yellow-600 hover:bg-white rounded-lg">&gt;</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold mb-2"><div className="text-red-500">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-500">토</div></div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarBlanks.map(b => <div key={`blank-${b}`} className="p-1 sm:p-2"></div>)}
                  {calendarDays.map(d => {
                    const currentDateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isSelected = currentDateStr === quoteDate;
                    const isToday = currentDateStr === getTodayKST();
                    return (<button key={d} onClick={() => setQuoteDate(currentDateStr)} className={`py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-extrabold ${isSelected ? 'bg-yellow-500 text-white shadow-md transform scale-105' : isToday ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'text-gray-700 hover:bg-gray-200'}`}>{d}</button>)
                  })}
                </div>
              </div>
            </div>
            
          </div>
        </div>

        {/* === 우측 패널: 데이터 뷰 === */}
        <div className="w-full lg:w-3/4 flex flex-col gap-4 sm:gap-6 min-w-0">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-yellow-500 flex flex-col justify-center"><p className="text-xs font-extrabold text-gray-500 mb-1">견적 공급가액</p><p className="text-xl sm:text-2xl font-extrabold text-gray-900">{supplyTotal.toLocaleString()}원</p></div>
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-orange-500 flex flex-col justify-center"><p className="text-xs font-extrabold text-gray-500 mb-1">견적 부가세액</p><p className="text-xl sm:text-2xl font-extrabold text-gray-900">{vatTotal.toLocaleString()}원</p></div>
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-yellow-600 flex flex-col justify-center bg-yellow-50/30"><p className="text-sm font-extrabold text-yellow-800 mb-1">총 견적 합계액</p><p className="text-2xl sm:text-3xl font-extrabold text-yellow-800">{grandTotal.toLocaleString()}<span className="text-sm sm:text-lg ml-1">원</span></p></div>
          </div>

          <div className="bg-white p-3 sm:p-6 shadow-lg rounded-xl flex-grow flex flex-col min-w-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-800">3. 품목 입력</h2>
              <span className="text-xs sm:text-sm font-bold text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">견적 일자: {quoteDate}</span>
            </div>
            
            {/* PC 테이블 뷰 */}
            <div className="hidden lg:block w-full overflow-x-auto border border-gray-200 rounded-lg mb-4 bg-white">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left border-b-2 border-gray-300">
                    <th className="p-3 font-bold w-48 border-r text-gray-800">품목 불러오기</th>
                    <th className="p-3 font-bold border-r text-yellow-700">품명 (직접입력)</th>
                    <th className="p-3 font-bold w-32 border-r text-center text-gray-800">규격</th>
                    <th className="p-3 font-bold w-20 border-r text-center text-gray-800">수량</th>
                    <th className="p-3 font-bold w-28 border-r text-center text-gray-800">단가</th>
                    <th className="p-3 font-bold w-32 border-r text-right text-gray-800 pr-4">금액</th>
                    <th className="p-3 font-bold w-28 text-center text-gray-800">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      <td className="p-2 border-r"><select value={item.product_id} onChange={(e) => handleItemChange(index, 'product_id', e.target.value)} className="w-full p-2 border border-gray-300 rounded outline-none focus:border-yellow-500 font-bold bg-white text-gray-700"><option value="">직접 입력</option>{!selectedClient ? (<option value="disabled" disabled>선택 불가</option>) : (filteredProducts.map(prod => (<option key={prod.id} value={prod.id}>{prod.name}</option>)))}</select></td>
                      <td className="p-2 border-r"><input type="text" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} placeholder="품명 직접 타자" className="w-full p-2 outline-none font-bold bg-transparent focus:bg-yellow-50 rounded" /></td>
                      <td className="p-2 border-r"><input type="text" value={item.spec || ''} onChange={(e) => handleItemChange(index, 'spec', e.target.value)} placeholder="규격" className="w-full p-2 outline-none font-bold text-center text-gray-700 bg-transparent focus:bg-yellow-50 rounded" /></td>
                      <td className="p-2 border-r"><input type="number" min="0" value={item.qty === 0 ? '' : item.qty} onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))} className="w-full p-2 outline-none font-bold text-center text-blue-700 bg-transparent focus:bg-yellow-50 rounded" /></td>
                      <td className="p-2 border-r"><input type="number" min="0" value={item.price === 0 ? '' : item.price} onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))} className="w-full p-2 outline-none font-bold text-right text-gray-700 bg-transparent focus:bg-yellow-50 rounded" /></td>
                      <td className="p-2 border-r text-right font-extrabold text-gray-800 align-middle pr-4">{(item.qty * item.price).toLocaleString()}</td>
                      <td className="p-2 text-center align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => copyItem(index)} className="text-purple-600 font-bold text-xs px-2 py-1 border border-purple-200 rounded hover:bg-purple-50 transition">복사</button>
                          <button onClick={() => removeItem(item.id)} className="text-red-500 font-bold text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50 transition">삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드형 뷰 */}
            <div className="lg:hidden space-y-4 mb-4">
              {items.map((item, index) => (
                <div key={item.id} className="bg-white border-2 border-yellow-200 rounded-xl p-4 shadow-sm relative">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                    <span className="font-extrabold text-yellow-800 bg-yellow-100 px-2 py-1 rounded text-xs">품목 {index + 1}</span>
                    <div className="flex gap-2">
                      <button onClick={() => copyItem(index)} className="text-xs bg-purple-50 text-purple-600 px-2 py-1.5 rounded font-bold border border-purple-200">복사</button>
                      <button onClick={() => removeItem(item.id)} className="text-xs bg-red-50 text-red-600 px-2 py-1.5 rounded font-bold border border-red-200">삭제</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">품목 불러오기</label>
                      <select value={item.product_id} onChange={(e) => handleItemChange(index, 'product_id', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-yellow-500 text-sm font-bold bg-white text-gray-700">
                        <option value="">직접 입력</option>
                        {!selectedClient ? (<option value="disabled" disabled>거래처를 먼저 선택해주세요</option>) : (filteredProducts.map(prod => (<option key={prod.id} value={prod.id}>{prod.name}</option>)))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">품명 (직접입력 가능)</label>
                      <input type="text" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} placeholder="품명 입력" className="w-full p-2 border border-gray-300 outline-none font-bold text-sm bg-white rounded-lg focus:border-yellow-500" />
                    </div>
                    <div className="flex gap-2">
                      <div className="w-1/2">
                        <label className="block text-xs font-bold text-gray-600 mb-1">규격</label>
                        <input type="text" value={item.spec || ''} onChange={(e) => handleItemChange(index, 'spec', e.target.value)} placeholder="규격 입력" className="w-full p-2 border border-gray-300 outline-none font-bold text-sm bg-white rounded-lg focus:border-yellow-500" />
                      </div>
                      <div className="w-1/2">
                        <label className="block text-xs font-bold text-gray-600 mb-1">수량</label>
                        <input type="number" min="0" value={item.qty === 0 ? '' : item.qty} onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))} placeholder="0" className="w-full p-2 border border-gray-300 outline-none font-bold text-sm text-blue-700 bg-white rounded-lg focus:border-yellow-500 text-right" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">단가</label>
                      <input type="number" min="0" value={item.price === 0 ? '' : item.price} onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))} placeholder="0" className="w-full p-2 border border-gray-300 outline-none font-bold text-sm bg-white rounded-lg focus:border-yellow-500 text-right" />
                    </div>
                    <div className="pt-3 border-t border-dashed border-gray-200 text-right">
                      <span className="text-xs font-bold text-gray-500 mr-2">견적 금액:</span>
                      <span className="text-lg font-extrabold text-yellow-700">{(item.qty * item.price).toLocaleString()}원</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mt-2 border-t pt-4 gap-4">
              <button onClick={addItem} className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 px-6 rounded-lg shadow transition text-sm flex justify-center items-center gap-2"><span>+ 빈 품목 줄 추가</span></button>
              <button onClick={handleSave} disabled={isSaving} className={`w-full sm:w-auto text-white font-extrabold py-3 px-10 rounded-xl shadow-lg transition text-base ${isSaving ? 'bg-yellow-400 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600 hover:-translate-y-1'}`}>{isSaving ? '저장 중...' : '견적서 발행 및 저장하기'}</button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}