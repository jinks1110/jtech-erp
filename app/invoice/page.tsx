"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Client { id: string; name: string; business_number?: string; ceo_name?: string; }
interface Product { id: string; name: string; spec: string; price: number; is_vat_included: boolean; client_id: string; }
interface InvoiceItem { id: string; product_id: string; name: string; spec: string; qty: number; price: number; is_vat_included: boolean; }

export default function InvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const getTodayKST = () => {
    const offset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - offset).toISOString().slice(0, 10);
  };
  const [invoiceDate, setInvoiceDate] = useState(getTodayKST());
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: Date.now().toString(), product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }
  ]);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', desc: '', confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm: () => {} });

  const closeModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, desc: string, onConfirm = closeModal) => { setConfirmModal({ isOpen: true, title, desc, confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm }); };

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return router.push('/login');

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        if (!profile) return;

        const { data: clientsData } = await supabase.from('clients').select('id, name, business_number, ceo_name').eq('company_id', profile.company_id).eq('is_active', true).order('name');
        const { data: productsData } = await supabase.from('products').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('name');
        
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

  const filteredProducts = selectedClient ? products.filter(p => p.client_id === selectedClient.id) : []; 

  const handleClientSelect = (client: Client) => { 
    setSelectedClient(client); 
    setIsClientModalOpen(false); 
  };

  const addItemRow = () => setItems([...items, { id: Date.now().toString(), product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);
  const copyItemRow = (index: number) => { const itemToCopy = items[index]; const newItems = [...items]; newItems.splice(index + 1, 0, { ...itemToCopy, id: Date.now().toString() }); setItems(newItems); };
  const removeItemRow = (id: string) => { if (items.length === 1) return setItems([{ id: Date.now().toString(), product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]); setItems(items.filter(item => item.id !== id)); };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number | boolean) => {
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
    if (!selectedClient) return showAlert('입력 오류', '거래처를 먼저 선택해주세요.');
    const validItems = items.filter(item => item.name.trim() !== '' && item.qty > 0);
    if (validItems.length === 0) return showAlert('입력 오류', '최소 1개 이상의 유효한 품목(수량 1 이상)을 입력해주세요.');

    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session!.user.id).single();

      const dateStr = invoiceDate.replace(/-/g, '');
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const generatedInvoiceNo = `INV-${dateStr}-${randomStr}`;

      const { data: invoiceData, error: invoiceError } = await supabase.from('invoices').insert([{
        company_id: profile!.company_id, client_id: selectedClient.id, invoice_no: generatedInvoiceNo,
        created_at: `${invoiceDate}T09:00:00Z`,
        supply_amount: supplyTotal, vat_amount: vatTotal, total_amount: grandTotal
      }]).select().single();
      if (invoiceError) throw invoiceError;

      const itemsToInsert = validItems.map(item => ({
        invoice_id: invoiceData.id, product_id: item.product_id || null, name: item.name, spec: item.spec, qty: item.qty, price: item.price
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      showAlert('발행 완료', '명세서가 성공적으로 발행되었습니다.', () => { closeModal(); router.push(`/sales/${invoiceData.id}`); });
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
      
      {/* 알림 모달 */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4">
          <div className="absolute inset-0 bg-gray-900/10 backdrop-blur-[2px]" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 font-medium text-sm whitespace-pre-line">{confirmModal.desc}</p>
            <div className="flex justify-end"><button onClick={confirmModal.onConfirm} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg shadow-md transition">확인</button></div>
          </div>
        </div>
      )}

      {/* === 절대 무시 못하는 강제 인라인 스타일 모달 (명세서 블루 테마) === */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsClientModalOpen(false)}></div>
          
          {/* 강제 높이 지정 (style 적용) + overflow-hidden */}
          <div 
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col z-10 border-2 border-blue-600 overflow-hidden animate-fade-in-up"
            style={{ height: '70vh', maxHeight: '700px' }} // 브라우저가 무조건 높이를 자름
          >
            {/* 고정 헤더 */}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
               <h3 className="text-lg font-extrabold text-blue-900 flex items-center gap-2"><span>🏢</span> 거래처 선택</h3>
               <button onClick={() => setIsClientModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold text-3xl leading-none">&times;</button>
            </div>
            
            {/* 고정 검색창 */}
            <div className="p-4 border-b shrink-0 bg-white">
               <div className="relative">
                 <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">🔍</span>
                 <input 
                   type="text" 
                   placeholder="상호명을 검색하세요..." 
                   className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-200 rounded-lg outline-none focus:border-blue-600 font-bold text-gray-800 text-sm" 
                   value={modalSearchTerm} 
                   onChange={e => setModalSearchTerm(e.target.value)} 
                   autoFocus 
                 />
               </div>
            </div>
            
            {/* 강제 스크롤 영역 (style 적용) */}
            <div 
              className="flex-1 p-4 bg-gray-50 custom-scrollbar"
              style={{ overflowY: 'auto', minHeight: 0 }} // 브라우저가 무조건 세로 스크롤을 만들게 강제함
            >
               <div className="flex flex-col gap-2">
                 {clients.filter(c => c.name.toLowerCase().includes(modalSearchTerm.toLowerCase())).map(client => (
                   <button 
                     key={client.id} 
                     onClick={() => handleClientSelect(client)} 
                     className="text-left p-3 border border-gray-200 rounded-lg bg-white hover:bg-blue-50 hover:border-blue-400 transition shadow-sm group flex justify-between items-center"
                   >
                     <div>
                       <div className="font-extrabold text-gray-900 group-hover:text-blue-800 text-base mb-1">{client.name}</div>
                       <div className="text-xs text-gray-500 font-medium">
                         사업자: {client.business_number || '-'} | 대표: {client.ceo_name || '-'}
                       </div>
                     </div>
                     <span className="shrink-0 bg-gray-100 text-gray-500 group-hover:bg-blue-600 group-hover:text-white px-3 py-1.5 rounded-md text-xs font-bold transition">선택</span>
                   </button>
                 ))}
                 {clients.filter(c => c.name.toLowerCase().includes(modalSearchTerm.toLowerCase())).length === 0 && (
                   <div className="text-center py-10 text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-lg">
                     검색된 거래처가 없습니다.
                   </div>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } 
        .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
      ` }} />

      <div className="max-w-[95%] xl:max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">
        
        <div className="w-full lg:w-1/4 space-y-4 shrink-0">
          <div className="bg-white p-5 md:p-6 shadow-lg rounded-xl border-t-4 border-blue-600 lg:sticky lg:top-6">
            <div className="mb-6 border-b pb-4"><h1 className="text-xl md:text-2xl font-extrabold">명세서 작성</h1><p className="text-gray-500 text-sm mt-1 font-bold">신규 거래명세서 발행</p></div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">1. 거래처 선택</label>
              {!selectedClient ? (
                <button 
                  onClick={() => setIsClientModalOpen(true)} 
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 border-dashed py-4 rounded-xl font-extrabold flex items-center justify-center gap-2 transition shadow-sm hover:shadow"
                >
                  <span className="text-xl">🔍</span> 거래처 검색 및 선택하기
                </button>
              ) : (
                <div className="bg-blue-50 border-2 border-blue-400 p-4 rounded-xl flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">선택된 거래처</p>
                    <div className="flex items-center gap-2"><span className="text-xl">🏢</span><span className="text-lg font-extrabold text-blue-900">{selectedClient.name}</span></div>
                  </div>
                  <button onClick={() => setIsClientModalOpen(true)} className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 shadow-sm transition">변경</button>
                </div>
              )}
            </div>

            <div className="h-px bg-gray-200 my-6"></div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-bold text-gray-700">2. 작성 일자</label>
                <input type="date" value={invoiceDate} onChange={(e) => { setInvoiceDate(e.target.value); setCalendarMonth(new Date(e.target.value)); }} className="border border-gray-300 rounded px-2 py-1 text-sm font-bold outline-none focus:border-blue-500 text-blue-700"/>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-inner">
                <div className="flex justify-between items-center mb-4">
                  <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-2 font-bold text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg">&lt;</button>
                  <span className="font-extrabold text-blue-900 text-lg">{calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월</span>
                  <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-2 font-bold text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg">&gt;</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold mb-2"><div className="text-red-500">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-500">토</div></div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarBlanks.map(b => <div key={`blank-${b}`} className="p-1 sm:p-2"></div>)}
                  {calendarDays.map(d => {
                    const currentDateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isSelected = currentDateStr === invoiceDate;
                    const isToday = currentDateStr === getTodayKST();
                    return (<button key={d} onClick={() => setInvoiceDate(currentDateStr)} className={`py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-extrabold ${isSelected ? 'bg-blue-600 text-white shadow-md transform scale-105' : isToday ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'text-gray-700 hover:bg-gray-200'}`}>{d}</button>)
                  })}
                </div>
              </div>
            </div>
            
          </div>
        </div>

        <div className="w-full lg:w-3/4 flex flex-col gap-4 sm:gap-6 min-w-0">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-blue-500 flex flex-col justify-center"><p className="text-xs font-extrabold text-gray-500 mb-1">공급가액</p><p className="text-xl sm:text-2xl font-extrabold text-gray-900">{supplyTotal.toLocaleString()}원</p></div>
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-purple-500 flex flex-col justify-center"><p className="text-xs font-extrabold text-gray-500 mb-1">부가세액</p><p className="text-xl sm:text-2xl font-extrabold text-gray-900">{vatTotal.toLocaleString()}원</p></div>
            <div className="bg-white p-4 sm:p-5 shadow-lg rounded-xl border border-gray-200 border-l-4 border-l-green-500 flex flex-col justify-center bg-green-50/30"><p className="text-sm font-extrabold text-green-700 mb-1">총 합계액</p><p className="text-2xl sm:text-3xl font-extrabold text-green-700">{grandTotal.toLocaleString()}<span className="text-sm sm:text-lg ml-1">원</span></p></div>
          </div>

          <div className="bg-white p-3 sm:p-6 shadow-lg rounded-xl flex-grow flex flex-col min-w-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 border-b border-dashed pb-3">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-800">3. 품목 입력</h2>
              <span className="text-xs sm:text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">일자: {invoiceDate}</span>
            </div>
            
            <div className="hidden lg:block w-full overflow-x-auto border border-gray-200 rounded-lg mb-4 bg-white">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left border-b-2 border-gray-300">
                    <th className="p-3 font-bold w-48 border-r text-gray-800">품목 불러오기</th>
                    <th className="p-3 font-bold border-r text-blue-700">품명 (직접입력)</th>
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
                      <td className="p-2 border-r"><select value={item.product_id} onChange={(e) => handleItemChange(index, 'product_id', e.target.value)} className="w-full p-2 border border-gray-300 rounded outline-none focus:border-blue-500 font-bold bg-white text-gray-700"><option value="">직접 입력</option>{!selectedClient ? (<option value="disabled" disabled>선택 불가</option>) : (filteredProducts.map(prod => (<option key={prod.id} value={prod.id}>{prod.name}</option>)))}</select></td>
                      <td className="p-2 border-r"><input type="text" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} placeholder="품명 직접 타자" className="w-full p-2 outline-none font-bold bg-transparent focus:bg-blue-50 rounded" /></td>
                      <td className="p-2 border-r"><input type="text" value={item.spec || ''} onChange={(e) => handleItemChange(index, 'spec', e.target.value)} placeholder="규격" className="w-full p-2 outline-none font-bold text-center text-gray-700 bg-transparent focus:bg-blue-50 rounded" /></td>
                      <td className="p-2 border-r"><input type="number" min="0" value={item.qty === 0 ? '' : item.qty} onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))} className="w-full p-2 outline-none font-bold text-center text-blue-700 bg-transparent focus:bg-blue-50 rounded" /></td>
                      <td className="p-2 border-r"><input type="number" min="0" value={item.price === 0 ? '' : item.price} onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))} className="w-full p-2 outline-none font-bold text-right text-gray-700 bg-transparent focus:bg-blue-50 rounded" /></td>
                      <td className="p-2 border-r text-right font-extrabold text-gray-800 align-middle pr-4">{(item.qty * item.price).toLocaleString()}</td>
                      <td className="p-2 text-center align-middle whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => copyItemRow(index)} className="text-purple-600 font-bold text-xs px-2 py-1 border border-purple-200 rounded hover:bg-purple-50 transition">복사</button>
                          <button onClick={() => removeItemRow(item.id)} className="text-red-500 font-bold text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50 transition">삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden space-y-4 mb-4">
              {items.map((item, index) => (
                <div key={item.id} className="bg-white border-2 border-blue-200 rounded-xl p-4 shadow-sm relative">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                    <span className="font-extrabold text-blue-800 bg-blue-100 px-2 py-1 rounded text-xs">품목 {index + 1}</span>
                    <div className="flex gap-2">
                      <button onClick={() => copyItemRow(index)} className="text-xs bg-purple-50 text-purple-600 px-2 py-1.5 rounded font-bold border border-purple-200">복사</button>
                      <button onClick={() => removeItemRow(item.id)} className="text-xs bg-red-50 text-red-600 px-2 py-1.5 rounded font-bold border border-red-200">삭제</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">품목 불러오기</label>
                      <select value={item.product_id} onChange={(e) => handleItemChange(index, 'product_id', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 text-sm font-bold bg-white text-gray-700">
                        <option value="">직접 입력</option>
                        {!selectedClient ? (<option value="disabled" disabled>거래처를 먼저 선택해주세요</option>) : (filteredProducts.map(prod => (<option key={prod.id} value={prod.id}>{prod.name}</option>)))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">품명 (직접입력 가능)</label>
                      <input type="text" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} placeholder="품명 입력" className="w-full p-2 border border-gray-300 outline-none font-bold text-sm bg-white rounded-lg focus:border-blue-500" />
                    </div>
                    <div className="flex gap-2">
                      <div className="w-1/2">
                        <label className="block text-xs font-bold text-gray-600 mb-1">규격</label>
                        <input type="text" value={item.spec || ''} onChange={(e) => handleItemChange(index, 'spec', e.target.value)} placeholder="규격 입력" className="w-full p-2 border border-gray-300 outline-none font-bold text-sm bg-white rounded-lg focus:border-blue-500" />
                      </div>
                      <div className="w-1/2">
                        <label className="block text-xs font-bold text-gray-600 mb-1">수량</label>
                        <input type="number" min="0" value={item.qty === 0 ? '' : item.qty} onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))} placeholder="0" className="w-full p-2 border border-gray-300 outline-none font-bold text-sm text-blue-700 bg-white rounded-lg focus:border-blue-500 text-right" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">단가</label>
                      <input type="number" min="0" value={item.price === 0 ? '' : item.price} onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))} placeholder="0" className="w-full p-2 border border-gray-300 outline-none font-bold text-sm bg-white rounded-lg focus:border-blue-500 text-right" />
                    </div>
                    <div className="pt-3 border-t border-dashed border-gray-200 text-right">
                      <span className="text-xs font-bold text-gray-500 mr-2">금액:</span>
                      <span className="text-lg font-extrabold text-blue-700">{(item.qty * item.price).toLocaleString()}원</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mt-2 border-t pt-4 gap-4">
              <button onClick={addItemRow} className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 px-6 rounded-lg shadow transition text-sm flex justify-center items-center gap-2"><span>+ 빈 품목 줄 추가</span></button>
              <button onClick={handleSave} disabled={isSaving} className={`w-full sm:w-auto text-white font-extrabold py-3 px-10 rounded-xl shadow-lg transition text-base ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1'}`}>{isSaving ? '저장 중...' : '명세서 발행 및 저장하기'}</button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}