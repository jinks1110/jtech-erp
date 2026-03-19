"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface QuotationDetail {
  id: string; company_id: string; client_id: string; quotation_no: string;
  supply_amount: number; vat_amount: number; total_amount: number; created_at: string;
  clients: { name: string; business_number: string; address: string; contact: string; };
  companies: { name: string; business_number: string; ceo_name: string; address: string; contact: string; };
}

interface QuotationItem { id?: string; product_id?: string; name: string; spec: string; qty: number; price: number; is_vat_included?: boolean; }
interface Product { id: string; name: string; spec: string; price: number; is_vat_included: boolean; }

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quotationId = params.id as string;

  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<QuotationItem[]>([]);
  const [editDate, setEditDate] = useState(''); 
  const [isUpdating, setIsUpdating] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', desc: '', isAlert: false,
    confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm: async () => {}
  });

  const closeModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, desc: string, onConfirm = closeModal) => {
    setConfirmModal({ isOpen: true, title, desc, isAlert: true, confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm });
  };

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('로그인이 필요합니다.');

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        
        const { data: invData } = await supabase.from('quotations').select('*, clients (name, business_number, address, contact), companies (name, business_number, ceo_name, address, contact)').eq('id', quotationId).single();
        setQuotation(invData as unknown as QuotationDetail);
        
        const { data: itemsData } = await supabase.from('quotation_items').select('*').eq('quotation_id', quotationId).order('created_at', { ascending: true });
        setItems(itemsData || []);

        if (profile) {
          const { data: productsData } = await supabase.from('products').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('name', { ascending: true });
          if (productsData) setProducts(productsData);
        }
      } catch (error) {
        alert('조회 실패');
      } finally {
        setLoading(false);
      }
    };
    if (quotationId) fetchDetail();
  }, [quotationId]);

  const handleCopyQuotation = () => {
    setConfirmModal({
      isOpen: true, title: '견적서 복사', desc: '이 견적서를 똑같이 복사하여 새 견적서를 작성하시겠습니까?\n(견적일자는 오늘 날짜로 자동 세팅됩니다.)', isAlert: false,
      confirmText: '복사하기', confirmColor: 'bg-purple-600 hover:bg-purple-700',
      onConfirm: async () => {
        closeModal();
        try {
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          const generatedQuotationNo = `EST-${dateStr}-${randomStr}`;

          const { data: newQuote, error: quoteError } = await supabase.from('quotations').insert([{
            company_id: quotation!.company_id, client_id: quotation!.client_id, quotation_no: generatedQuotationNo,
            supply_amount: quotation!.supply_amount, vat_amount: quotation!.vat_amount, total_amount: quotation!.total_amount
          }]).select().single();
          if (quoteError) throw quoteError;

          const itemsToInsert = items.map(item => ({
            quotation_id: newQuote.id, product_id: item.product_id || null, name: item.name, spec: item.spec, qty: item.qty, price: item.price
          }));

          const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;

          showAlert('복사 완료', '견적서가 성공적으로 복사되었습니다!\n복사된 새 견적서 화면으로 이동합니다.', () => {
            closeModal();
            router.push(`/quotation/${newQuote.id}`);
          });
        } catch (error: any) {
          showAlert('복사 실패', '견적서 복사에 실패했습니다.');
        }
      }
    });
  };

  const startEditing = () => {
    setIsEditing(true);
    setEditItems([...items]); 
    const d = new Date(quotation!.created_at);
    setEditDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const addEditItem = () => setEditItems([...editItems, { product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);
  const removeEditItem = (index: number) => { const newItems = [...editItems]; newItems.splice(index, 1); setEditItems(newItems); };

  const handleProductSelect = (index: number, productId: string) => {
    const selectedProduct = products.find(p => p.id === productId);
    const newItems = [...editItems];
    if (selectedProduct) {
      newItems[index] = { ...newItems[index], product_id: selectedProduct.id, name: selectedProduct.name, spec: selectedProduct.spec || '', qty: newItems[index].qty === 0 ? 1 : newItems[index].qty, price: selectedProduct.price, is_vat_included: selectedProduct.is_vat_included };
    }
    setEditItems(newItems);
  };

  const handleUpdate = async () => {
    if (editItems.some(item => !item.name || item.qty <= 0)) { showAlert('입력 오류', '모든 품목을 올바르게 입력하고 수량을 지정해주세요.'); return; }
    try {
      setIsUpdating(true);
      let supplyTotal = 0; let vatTotal = 0;

      editItems.forEach(item => {
        const lineTotal = item.qty * item.price;
        if (item.is_vat_included) { const supply = Math.round(lineTotal / 1.1); supplyTotal += supply; vatTotal += (lineTotal - supply); } 
        else { supplyTotal += lineTotal; vatTotal += Math.round(lineTotal * 0.1); }
      });
      const grandTotal = supplyTotal + vatTotal;

      const { error: updateError } = await supabase.from('quotations').update({
        created_at: `${editDate}T09:00:00Z`, supply_amount: supplyTotal, vat_amount: vatTotal, total_amount: grandTotal
      }).eq('id', quotationId);
      if (updateError) throw updateError;

      await supabase.from('quotation_items').delete().eq('quotation_id', quotationId);
      const itemsToInsert = editItems.map(item => ({
        quotation_id: quotationId, product_id: item.product_id || null, name: item.name, spec: item.spec, qty: item.qty, price: item.price
      }));
      const { error: insertError } = await supabase.from('quotation_items').insert(itemsToInsert);
      if (insertError) throw insertError;

      showAlert('수정 완료', '견적서가 성공적으로 수정되었습니다.', () => {
        closeModal();
        window.location.reload(); 
      });
    } catch (error: any) {
      showAlert('수정 실패', '수정에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="p-10 text-center">데이터를 불러오는 중입니다...</div>;
  if (!quotation) return <div className="p-10 text-center">견적서를 찾을 수 없습니다.</div>;
  const minRows = 8; const totalRows = Math.max(minRows, items.length);

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen text-black print:bg-white print:p-0 relative">
      
      {/* 커스텀 모달 */}
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

      <style dangerouslySetInnerHTML={{ 
        __html: `@media print { @page { size: A4 portrait; margin: 0 !important; } body { margin: 0; padding: 0; background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print-safe-container { width: 210mm; height: 296mm; box-sizing: border-box; padding: 15mm; overflow: hidden; page-break-inside: avoid; margin: 0 auto; border: none !important; box-shadow: none !important; } .no-print { display: none !important; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }` 
      }} />

      <div className="max-w-4xl mx-auto mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print bg-white p-4 shadow rounded-lg">
        <button onClick={() => router.back()} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 font-bold text-sm w-full sm:w-auto">← 목록으로</button>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          {!isEditing ? (
            <>
              <button onClick={handleCopyQuotation} className="flex-1 sm:flex-none bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition font-bold text-sm shadow-md">문서 복사</button>
              <button onClick={startEditing} className="flex-1 sm:flex-none bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition font-bold text-sm shadow-md">내용 수정</button>
              <button onClick={() => window.print()} className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-extrabold text-sm shadow animate-pulse hover:animate-none">🖨️ 인쇄 (A4)</button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(false)} className="flex-1 sm:flex-none bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 transition font-bold text-sm">취소</button>
              <button onClick={handleUpdate} disabled={isUpdating} className={`flex-1 sm:flex-none px-4 py-2 rounded text-white font-bold transition text-sm ${isUpdating ? 'bg-yellow-300' : 'bg-yellow-500 hover:bg-yellow-600'}`}>{isUpdating ? '저장 중...' : '수정 완료'}</button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="max-w-4xl mx-auto bg-white p-4 md:p-8 shadow-lg border-2 border-yellow-400 rounded-lg no-print">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-yellow-600 border-b pb-2">견적서 내용 수정</h2>
          <div className="mb-4 md:mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <label className="block text-sm font-bold text-gray-700 mb-2">견적 일자 변경</label>
            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full md:w-auto border border-yellow-300 rounded p-2 outline-none focus:border-yellow-500 bg-white font-bold text-gray-800" />
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full mb-4 border-collapse min-w-[600px]">
              <thead><tr className="bg-gray-100 text-left text-sm"><th className="p-2 border">품목 선택 (변경 시)</th><th className="p-2 border">품명 (직접입력)</th><th className="p-2 border w-24">수량</th><th className="p-2 border w-32">단가</th><th className="p-2 border text-center w-16">관리</th></tr></thead>
              <tbody>{editItems.map((item, idx) => (
                  <tr key={idx} className="text-sm">
                    <td className="border p-2"><select className="w-full outline-none bg-transparent" value={item.product_id || ''} onChange={(e) => handleProductSelect(idx, e.target.value)}><option value="">품목 변경 안함</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} {p.spec ? `(${p.spec})` : ''}</option>)}</select></td>
                    <td className="border p-2"><input type="text" className="w-full outline-none" value={item.name} onChange={(e) => { const newItems = [...editItems]; newItems[idx].name = e.target.value; setEditItems(newItems); }} /></td>
                    <td className="border p-2"><input type="number" className="w-full outline-none text-right" value={item.qty === 0 ? '' : item.qty} onChange={(e) => { const newItems = [...editItems]; newItems[idx].qty = Number(e.target.value); setEditItems(newItems); }} /></td>
                    <td className="border p-2"><input type="number" className="w-full outline-none text-right" value={item.price === 0 ? '' : item.price} onChange={(e) => { const newItems = [...editItems]; newItems[idx].price = Number(e.target.value); setEditItems(newItems); }} /></td>
                    <td className="border p-2 text-center"><button onClick={() => removeEditItem(idx)} className="text-red-500 font-bold px-2 py-1 bg-red-50 rounded hover:bg-red-100">삭제</button></td>
                  </tr>
                ))}</tbody>
            </table>
          </div>
          <button onClick={addEditItem} className="w-full md:w-auto bg-gray-800 text-white px-6 py-3 md:py-2 rounded hover:bg-gray-700 transition font-bold text-sm">+ 품목 줄 추가</button>
        </div>
      ) : (
        <div className="w-full overflow-x-auto pb-4">
          <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg border border-gray-300 print-safe-container flex flex-col min-w-[210mm]">
            <h1 className="text-4xl font-extrabold text-center mb-8 tracking-[1em] underline underline-offset-8 decoration-2 shrink-0">견 적 서</h1>
            
            <div className="flex justify-between items-stretch mb-2 shrink-0 gap-4">
              <div className="w-1/2 flex flex-col justify-between">
                <div><div className="flex items-end mb-2 border-b-2 border-black pb-1"><span className="text-2xl font-bold">{quotation.clients?.name}</span><span className="text-lg ml-2">귀하</span></div><p className="text-sm font-bold text-gray-600">견적일자: {new Date(quotation.created_at).toLocaleDateString()}</p></div>
                <div className="bg-gray-100 p-3 border border-black text-sm mt-4 flex flex-col justify-center h-[72px]"><p className="font-bold text-lg mb-1">견적 총액: ￦ {quotation.total_amount.toLocaleString()}</p><p className="text-gray-700">( 부가세 포함 금액 )</p></div>
              </div>
              <div className="w-1/2 flex flex-col">
                <table className="w-full h-full border-collapse border border-black text-xs md:text-sm">
                  <tbody>
                    <tr><th rowSpan={4} className="border border-black bg-gray-100 p-1 w-6 text-center leading-tight">공<br/>급<br/>자</th><th className="border border-black bg-gray-100 p-1 w-20 whitespace-nowrap text-center">등록번호</th><td colSpan={3} className="border border-black p-1 font-bold text-center align-middle">{quotation.companies?.business_number}</td></tr>
                    <tr><th className="border border-black bg-gray-100 p-1 text-center whitespace-nowrap">상호(명)</th><td className="border border-black p-1 font-bold text-center align-middle">{quotation.companies?.name}</td><th className="border border-black bg-gray-100 p-1 w-10 text-center whitespace-nowrap">성명</th><td className="border border-black p-1 text-center align-middle">{quotation.companies?.ceo_name}</td></tr>
                    <tr><th className="border border-black bg-gray-100 p-1 text-center whitespace-nowrap">사업장주소</th><td colSpan={3} className="border border-black px-2 py-1 text-left align-middle leading-snug break-keep">{quotation.companies?.address}</td></tr>
                    <tr><th className="border border-black bg-gray-100 p-1 text-center whitespace-nowrap">연락처</th><td colSpan={3} className="border border-black p-1 text-center align-middle">{quotation.companies?.contact}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mb-4 text-sm font-bold shrink-0">아래와 같이 견적합니다.</p>

            <div className="flex-grow">
              <table className="w-full border-collapse border border-black text-sm mb-4 table-fixed">
                <thead><tr className="bg-gray-100 text-center font-bold"><th className="p-2 border border-black w-10">No</th><th className="p-2 border border-black w-48">품 명</th><th className="p-2 border border-black w-24">규 격</th><th className="p-2 border border-black w-16">수 량</th><th className="p-2 border border-black w-24">단 가</th><th className="p-2 border border-black w-28">금 액</th><th className="p-2 border border-black w-20">비 고</th></tr></thead>
                <tbody>
                  {Array.from({ length: totalRows }).map((_, idx) => {
                    const item = items[idx];
                    if (!item) return (<tr key={idx} className="h-7"><td className="border border-black text-transparent select-none">.</td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td></tr>);
                    return (<tr key={idx} className="text-center h-7"><td className="border border-black">{idx + 1}</td><td className="border border-black text-left px-2 font-bold truncate">{item.name}</td><td className="border border-black text-xs truncate">{item.spec}</td><td className="border border-black">{item.qty}</td><td className="border border-black text-right px-2">{item.price.toLocaleString()}</td><td className="border border-black text-right px-2 font-bold">{(item.qty * item.price).toLocaleString()}</td><td className="border border-black text-xs text-gray-500">{item.is_vat_included ? 'VAT포함' : ''}</td></tr>);
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-extrabold border-t-2 border-black"><td colSpan={5} className="border border-black p-2 text-center tracking-widest">합 계</td><td colSpan={2} className="border border-black p-2 text-right pr-6">{quotation.supply_amount.toLocaleString()}</td></tr>
                  <tr className="bg-gray-100 font-bold"><td colSpan={5} className="border border-black p-2 text-center">부 가 세</td><td colSpan={2} className="border border-black p-2 text-right pr-6">{quotation.vat_amount.toLocaleString()}</td></tr>
                  <tr className="bg-white font-extrabold text-lg"><td colSpan={5} className="border border-black p-2 text-center">총 견 적 액</td><td colSpan={2} className="border border-black p-2 text-right pr-6 text-blue-800">￦ {quotation.total_amount.toLocaleString()}</td></tr>
                </tfoot>
              </table>
            </div>

            <div className="shrink-0 mt-4 pt-4 border-t-2 border-black text-sm space-y-1 text-gray-800 pb-2">
              <p className="font-bold">1. 견적 유효기간 : 견적일로부터 15일</p>
              <p className="font-bold">2. 결제 조건 : 납품 후 협의 (세금계산서 발행 가능)</p>
              <p className="font-bold">3. 납품 장소 : 귀사 지정 장소</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}