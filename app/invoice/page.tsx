"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Client {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  client_id: string; 
}

interface InvoiceItem {
  id: string; 
  product_id: string;
  name: string;
  qty: number;
  price: number;
}

export default function InvoiceCreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 데이터 상태
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // 거래처 검색 상태
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // === 신규: 키보드 방향키 이동을 위한 상태 ===
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // 품목 리스트 상태 
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: Date.now().toString(), product_id: '', name: '', qty: 0, price: 0 }
  ]);

  // 공통 모달창
  const [alertModal, setAlertModal] = useState({
    isOpen: false, title: '', desc: '', onConfirm: () => {}
  });

  const closeAlert = () => setAlertModal(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, desc: string, onConfirm = closeAlert) => {
    setAlertModal({ isOpen: true, title, desc, onConfirm });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        if (!profile) return;

        const { data: clientData } = await supabase.from('clients')
          .select('id, name')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .order('name');
        
        if (clientData) setClients(clientData);

        const { data: productData } = await supabase.from('products')
          .select('id, name, price, client_id')
          .eq('company_id', profile.company_id)
          .eq('is_active', true);

        if (productData) setProducts(productData);

      } catch (error) {
        console.error('데이터 로딩 에러:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  // 외부 클릭 시 거래처 검색 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()));

  const filteredProducts = selectedClient 
    ? products.filter(p => p.client_id === selectedClient.id)
    : []; 

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setClientSearchTerm(client.name);
    setShowClientDropdown(false);
    setHighlightedIndex(-1); // 선택 완료 시 방향키 초기화
  };

  const handleClientSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientSearchTerm(e.target.value);
    setShowClientDropdown(true);
    setHighlightedIndex(-1); // 검색어가 바뀌면 방향키 위치 초기화
    if (e.target.value !== selectedClient?.name) {
      setSelectedClient(null); 
    }
  };

  // === 신규: 키보드 조작 핸들러 ===
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showClientDropdown || filteredClients.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault(); // 커서 이동 방지
      setHighlightedIndex(prev => (prev < filteredClients.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // 폼 제출 방지
      if (highlightedIndex >= 0 && highlightedIndex < filteredClients.length) {
        handleClientSelect(filteredClients[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowClientDropdown(false);
      setHighlightedIndex(-1);
    }
  };

  const addItemRow = () => {
    setItems([...items, { id: Date.now().toString(), product_id: '', name: '', qty: 0, price: 0 }]);
  };

  const copyItemRow = (index: number) => {
    const itemToCopy = items[index];
    const newItems = [...items];
    newItems.splice(index + 1, 0, { ...itemToCopy, id: Date.now().toString() });
    setItems(newItems);
  };

  const removeItemRow = (id: string) => {
    if (items.length === 1) {
      setItems([{ id: Date.now().toString(), product_id: '', name: '', qty: 0, price: 0 }]);
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    
    if (field === 'product_id') {
      if (value === '') {
        newItems[index].product_id = '';
        newItems[index].name = '';
        newItems[index].price = 0;
      } else {
        const selectedProd = products.find(p => p.id === value);
        if (selectedProd) {
          newItems[index].product_id = selectedProd.id;
          newItems[index].name = selectedProd.name;
          newItems[index].price = selectedProd.price;
        }
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    
    setItems(newItems);
  };

  const totalSupply = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const totalVat = Math.floor(totalSupply * 0.1);
  const grandTotal = totalSupply + totalVat;

  const handleSaveInvoice = async () => {
    if (!selectedClient) {
      showAlert('확인 필요', '거래처를 먼저 검색하여 선택해주세요.');
      return;
    }

    const validItems = items.filter(item => item.name.trim() !== '' && item.qty > 0);
    if (validItems.length === 0) {
      showAlert('확인 필요', '최소 1개 이상의 유효한 품목(수량 1 이상)을 입력해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session!.user.id).single();

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
      const invoiceNo = `INV-${dateStr}-${randomStr}`;

      const { data: newInvoice, error: invoiceError } = await supabase.from('invoices').insert([{
        company_id: profile!.company_id,
        client_id: selectedClient.id,
        invoice_no: invoiceNo,
        supply_amount: totalSupply,
        vat_amount: totalVat,
        total_amount: grandTotal
      }]).select().single();

      if (invoiceError) throw invoiceError;

      const itemsToInsert = validItems.map(item => ({
        invoice_id: newInvoice.id,
        product_id: item.product_id || null, 
        name: item.name,
        qty: item.qty,
        price: item.price
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      showAlert('발행 완료', '명세서가 성공적으로 발행 및 저장되었습니다.', () => {
        closeAlert();
        router.push('/sales'); 
      });

    } catch (error) {
      console.error(error);
      showAlert('저장 실패', '명세서 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black relative">
      
      {/* 커스텀 알림 모달 */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4">
          <div className="absolute inset-0 bg-black bg-opacity-30" onClick={closeAlert}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{alertModal.title}</h3>
            <p className="text-gray-600 mb-6 font-medium text-sm whitespace-pre-line">{alertModal.desc}</p>
            <div className="flex justify-end">
              <button onClick={alertModal.onConfirm} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg shadow-md transition">확인</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }` }} />

      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* 타이틀 */}
        <div className="bg-white p-6 shadow-lg rounded-xl border-t-4 border-blue-600 flex items-center gap-3">
          <span className="text-3xl">✍️</span>
          <h1 className="text-2xl font-extrabold text-gray-900">신규 거래명세표 작성</h1>
        </div>

        <div className="bg-white p-6 shadow-lg rounded-xl border border-gray-200">
          {/* 거래처 검색 폼 */}
          <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-lg mb-8 relative" ref={searchRef}>
            <label className="block text-sm font-bold text-gray-700 mb-2">거래처 검색 (일부만 입력해도 찾아줍니다)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 font-bold">🔍</span>
              <input
                type="text"
                value={clientSearchTerm}
                onChange={handleClientSearchChange}
                onClick={() => setShowClientDropdown(true)}
                onKeyDown={handleKeyDown} // === 핵심: 키보드 이벤트 연결 ===
                className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-blue-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-bold text-gray-800 bg-white"
                placeholder="예: 삼덕전기"
              />
            </div>
            <p className="text-xs text-blue-600 font-bold mt-2">* 초성이나 단어 일부만 치시면 목록이 나타납니다. (방향키 ↓ ↑ 및 엔터로 선택 가능)</p>

            {/* 자동완성 드롭다운 */}
            {showClientDropdown && filteredClients.length > 0 && (
              <ul className="absolute z-20 w-full left-0 mt-1 bg-white border-2 border-blue-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {filteredClients.map((client, index) => (
                  <li
                    key={client.id}
                    className={`px-4 py-3 cursor-pointer font-extrabold text-blue-900 border-b border-gray-100 last:border-b-0 transition-colors ${
                      highlightedIndex === index ? 'bg-blue-100' : 'hover:bg-blue-50'
                    }`} // === 핵심: 키보드로 선택된 항목에 파란 배경색(bg-blue-100) 부여 ===
                    onClick={() => handleClientSelect(client)}
                    onMouseEnter={() => setHighlightedIndex(index)} // 마우스를 올리면 키보드 커서도 따라오도록 동기화
                  >
                    {client.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 품목 입력 테이블 */}
          <div className="overflow-x-auto mb-4 border border-gray-200 rounded-lg">
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left border-b-2 border-gray-300">
                  <th className="p-3 font-bold text-sm w-48 border-r text-gray-800">품목 불러오기</th>
                  <th className="p-3 font-bold text-sm border-r text-blue-600">품명 (직접입력 가능)</th>
                  <th className="p-3 font-bold text-sm w-24 border-r text-center text-gray-800">수량</th>
                  <th className="p-3 font-bold text-sm w-32 border-r text-center text-gray-800">단가</th>
                  <th className="p-3 font-bold text-sm w-36 border-r text-center text-gray-800">공급가액</th>
                  <th className="p-3 font-bold text-sm w-24 text-center text-gray-800">관리</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                    <td className="p-2 border-r">
                      <select 
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded outline-none focus:border-blue-500 text-sm font-bold bg-white text-gray-700"
                      >
                        <option value="">직접 입력</option>
                        {!selectedClient ? (
                          <option value="disabled" disabled>거래처를 먼저 선택해주세요</option>
                        ) : (
                          filteredProducts.map(prod => (
                            <option key={prod.id} value={prod.id}>{prod.name}</option>
                          ))
                        )}
                      </select>
                    </td>
                    <td className="p-2 border-r">
                      <input 
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        placeholder="품명 직접 타자"
                        className="w-full p-2 outline-none font-bold text-sm bg-transparent focus:bg-blue-50 rounded"
                      />
                    </td>
                    <td className="p-2 border-r">
                      <input 
                        type="number"
                        min="0"
                        value={item.qty || ''}
                        onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))}
                        className="w-full p-2 outline-none font-bold text-sm text-center text-blue-700 bg-transparent focus:bg-blue-50 rounded"
                      />
                    </td>
                    <td className="p-2 border-r">
                      <input 
                        type="number"
                        min="0"
                        value={item.price || ''}
                        onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))}
                        className="w-full p-2 outline-none font-bold text-sm text-right text-gray-700 bg-transparent focus:bg-blue-50 rounded"
                      />
                    </td>
                    <td className="p-2 border-r text-right font-extrabold text-gray-800 text-sm align-middle">
                      {(item.qty * item.price).toLocaleString()}원
                    </td>
                    <td className="p-2 text-center align-middle space-x-1 whitespace-nowrap">
                      <button onClick={() => copyItemRow(index)} className="text-purple-600 font-bold text-xs px-2 py-1 border border-purple-200 rounded hover:bg-purple-50 transition">복사</button>
                      <button onClick={() => removeItemRow(item.id)} className="text-red-500 font-bold text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50 transition">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button 
            onClick={addItemRow} 
            className="bg-[#1e293b] hover:bg-gray-800 text-white font-bold py-2 px-5 rounded-lg shadow transition text-sm flex items-center gap-2"
          >
            <span>+ 빈 품목 줄 추가</span>
          </button>

          {/* 합계 박스 */}
          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row justify-end items-end sm:items-center gap-6 md:gap-10">
            <div className="text-right">
              <p className="text-xs font-bold text-gray-500 mb-1">공급가액</p>
              <p className="text-lg font-bold text-gray-700">{totalSupply.toLocaleString()}원</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-500 mb-1">부가세</p>
              <p className="text-lg font-bold text-gray-500">{totalVat.toLocaleString()}원</p>
            </div>
            <div className="w-px h-12 bg-gray-300 hidden sm:block"></div>
            <div className="text-right">
              <p className="text-sm font-extrabold text-blue-700 mb-1">총 합계금액</p>
              <p className="text-3xl md:text-4xl font-extrabold text-gray-900">{grandTotal.toLocaleString()}<span className="text-xl font-bold ml-1">원</span></p>
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <button 
          onClick={handleSaveInvoice} 
          disabled={isSaving}
          className={`w-full text-white font-extrabold py-5 rounded-xl shadow-lg text-lg transition ${
            isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1'
          }`}
        >
          {isSaving ? '저장 중...' : '명세서 발행 및 저장하기'}
        </button>

      </div>
    </div>
  );
}