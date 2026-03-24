"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

interface InvoiceDetail {
  id: string;
  company_id: string; 
  invoice_no: string;
  issue_date: string;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
  created_at: string;
  client_id: string;
  clients: {
    name: string;
    business_number: string;
    address: string;
    contact: string;
  };
  companies: {
    name: string;
    business_number: string;
    ceo_name: string;
    address: string;
    contact: string;
    bank_account: string; 
  };
}

interface InvoiceItem {
  id?: string;
  product_id?: string;
  name: string;
  spec: string;
  qty: number;
  price: number;
  is_vat_included?: boolean;
}

interface Product {
  id: string;
  name: string;
  spec: string;
  price: number;
  is_vat_included: boolean;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_path: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editDate, setEditDate] = useState(''); 
  const [isUpdating, setIsUpdating] = useState(false);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    desc: '',
    confirmText: '확인',
    confirmColor: 'bg-blue-600 hover:bg-blue-700',
    onConfirm: async () => {}
  });

  const closeModal = () => setConfirmModal({ ...confirmModal, isOpen: false });

  const fetchInvoiceDetail = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', session.user.id)
        .single();
        
      if (profileError || !profile) {
        throw new Error('회사 정보를 불러오는데 실패했습니다.');
      }

      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select(`
          *,
          clients (name, business_number, address, contact),
          companies (name, business_number, ceo_name, address, contact, bank_account)
        `)
        .eq('id', invoiceId)
        .single();

      if (invError) throw invError;
      setInvoice(invData as unknown as InvoiceDetail);

      const { data: itemsData, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name', { ascending: true });
        
      if (productsData) setProducts(productsData);

      const { data: attachData, error: attachError } = await supabase
        .from('attachments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });

      if (!attachError && attachData) {
        setAttachments(attachData);
      }

    } catch (error: any) {
      console.error('상세 조회 에러:', error.message);
      alert('명세서 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceDetail();
    }
  }, [invoiceId]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleExcelExport = () => {
    if (!invoice || items.length === 0) return;
    try {
      const excelData = items.map((item, index) => ({
        '연번': index + 1,
        '품목명': item.name,
        '규격': item.spec || '',
        '수량': item.qty,
        '단가': item.price,
        '공급가액': item.price * item.qty
      }));
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "거래명세표");
      const fileName = `거래명세표_${invoice.clients?.name}_${invoice.invoice_no}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error: any) {
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const handleCopyInvoice = () => {
    setConfirmModal({
      isOpen: true,
      title: '명세서 복사',
      desc: '이 명세서를 똑같이 복사하여 새 명세서를 발행하시겠습니까?\n(작성일자는 오늘 날짜로 자동 세팅됩니다.)',
      confirmText: '복사하기',
      confirmColor: 'bg-purple-600 hover:bg-purple-700',
      onConfirm: async () => {
        closeModal();
        try {
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          const generatedInvoiceNo = `INV-${dateStr}-${randomStr}`;

          const { data: newInvoice, error: invError } = await supabase
            .from('invoices')
            .insert([{
              company_id: invoice!.company_id,
              client_id: invoice!.client_id,
              invoice_no: generatedInvoiceNo,
              supply_amount: invoice!.supply_amount,
              vat_amount: invoice!.vat_amount,
              total_amount: invoice!.total_amount
            }])
            .select()
            .single();

          if (invError) throw invError;

          const itemsToInsert = items.map(item => ({
            invoice_id: newInvoice.id,
            product_id: item.product_id || null,
            name: item.name,
            spec: item.spec,
            qty: item.qty,
            price: item.price
          }));

          const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;

          router.push(`/sales/${newInvoice.id}`);
        } catch (error: any) {
          alert('명세서 복사에 실패했습니다.');
          console.error(error);
        }
      }
    });
  };

  const startEditing = () => {
    setIsEditing(true);
    setEditItems([...items]); 
    
    const d = new Date(invoice!.created_at);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setEditDate(`${yyyy}-${mm}-${dd}`);
  };

  const addEditItem = () => {
    setEditItems([...editItems, { product_id: '', name: '', spec: '', qty: 0, price: 0, is_vat_included: false }]);
  };

  const removeEditItem = (index: number) => {
    const newItems = [...editItems];
    newItems.splice(index, 1);
    setEditItems(newItems);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const selectedProduct = products.find(p => p.id === productId);
    const newItems = [...editItems];
    if (selectedProduct) {
      newItems[index] = {
        ...newItems[index],
        product_id: selectedProduct.id,
        name: selectedProduct.name,
        spec: selectedProduct.spec || '',
        qty: newItems[index].qty === 0 ? 1 : newItems[index].qty,
        price: selectedProduct.price,
        is_vat_included: selectedProduct.is_vat_included
      };
    }
    setEditItems(newItems);
  };

  const handleUpdate = async () => {
    if (editItems.some(item => !item.name || item.qty <= 0)) {
      alert('모든 품목을 올바르게 입력하고 수량을 지정해주세요.');
      return;
    }
    try {
      setIsUpdating(true);
      let supplyTotal = 0;
      let vatTotal = 0;

      editItems.forEach(item => {
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

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          created_at: `${editDate}T09:00:00Z`, 
          supply_amount: supplyTotal,
          vat_amount: vatTotal,
          total_amount: grandTotal
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);

      const itemsToInsert = editItems.map(item => ({
        invoice_id: invoiceId,
        product_id: item.product_id || null,
        name: item.name,
        spec: item.spec,
        qty: item.qty,
        price: item.price
      }));

      const { error: insertError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (insertError) throw insertError;

      alert('명세서가 성공적으로 수정되었습니다.');
      setIsEditing(false);
      fetchInvoiceDetail(); 

    } catch (error: any) {
      alert('수정에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setIsUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${invoiceId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('attachments').insert([{
        invoice_id: invoiceId,
        file_name: file.name,
        file_path: filePath,
        file_url: urlData.publicUrl
      }]);

      if (dbError) throw dbError;

      fetchInvoiceDetail();
      alert('파일이 성공적으로 첨부되었습니다.');

    } catch (error: any) {
      alert('파일 업로드에 실패했습니다. (Storage 버킷을 생성했는지 확인해주세요.)');
    } finally {
      setIsUploading(false);
      e.target.value = ''; 
    }
  };

  const handleDeleteFile = (id: string, filePath: string) => {
    setConfirmModal({
      isOpen: true,
      title: '첨부파일 삭제',
      desc: '정말 이 첨부파일을 삭제하시겠습니까?',
      confirmText: '삭제하기',
      confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        closeModal();
        try {
          await supabase.storage.from('attachments').remove([filePath]);
          const { error } = await supabase.from('attachments').delete().eq('id', id);
          if (error) throw error;
          fetchInvoiceDetail(); 
        } catch (error: any) {
          alert('파일 삭제에 실패했습니다.');
        }
      }
    });
  };

  const renderInvoiceHalf = (typeLabel: string) => {
    if (!invoice) return null;
    
    const minRows = 5;
    const totalRows = Math.max(minRows, items.length);
    
    return (
      <div className="bg-white p-6 shadow-lg mb-4 print:shadow-none print:m-0 print:p-0 print-half border border-gray-300 print:border-none relative flex flex-col">
        
        <div className="flex justify-between items-end mb-4 border-b-2 border-black pb-2 shrink-0">
          <div className="w-1/3 flex flex-col justify-end">
            {typeLabel === '공급받는자 보관용' && invoice.companies?.bank_account && (
              <div className="mb-1">
                <span className="text-xs font-bold text-black">
                  [입금계좌] {invoice.companies.bank_account}
                </span>
              </div>
            )}
            <p className="text-xs font-bold mb-1">작성일자: {new Date(invoice.created_at).toLocaleDateString()}</p>
          </div>
          <div className="w-1/3 text-center">
            <h1 className="text-2xl font-extrabold tracking-[0.5em] underline underline-offset-4 decoration-2">거래명세표</h1>
            <p className="text-xs font-bold text-gray-500 mt-1">({typeLabel})</p>
          </div>
          <div className="w-1/3 text-right">
          </div>
        </div>

        <div className="flex justify-between gap-2 text-xs mb-4 shrink-0">
          <table className="w-1/2 border-collapse border border-black">
            <tbody>
              <tr>
                <th rowSpan={4} className="border border-black bg-gray-100 p-1 w-6 text-center leading-tight">공<br/>급<br/>받<br/>는<br/>자</th>
                <th className="border border-black bg-gray-100 p-1 w-16">등록번호</th>
                <td className="border border-black p-1 font-bold text-center">{invoice.clients?.business_number || ''}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 p-1">상호(명)</th>
                <td className="border border-black p-1 font-bold">{invoice.clients?.name} 귀하</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 p-1">사업장주소</th>
                <td className="border border-black p-1 truncate max-w-[120px]">{invoice.clients?.address || ''}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 p-1">연락처</th>
                <td className="border border-black p-1">{invoice.clients?.contact || ''}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-1/2 border-collapse border border-black">
            <tbody>
              <tr>
                <th rowSpan={4} className="border border-black bg-gray-100 p-1 w-6 text-center leading-tight">공<br/>급<br/>자</th>
                <th className="border border-black bg-gray-100 p-1 w-16">등록번호</th>
                <td colSpan={3} className="border border-black p-1 font-bold text-center">{invoice.companies?.business_number || '사업자번호 미등록'}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 p-1">상호(명)</th>
                <td className="border border-black p-1 font-bold">{invoice.companies?.name || 'J-TECH'}</td>
                <th className="border border-black bg-gray-100 p-1 w-10">성명</th>
                <td className="border border-black p-1 text-center">{invoice.companies?.ceo_name || ''}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 p-1">사업장주소</th>
                <td colSpan={3} className="border border-black p-1 text-[10px] leading-tight truncate max-w-[150px]">{invoice.companies?.address || ''}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 p-1">연락처</th>
                <td colSpan={3} className="border border-black p-1">{invoice.companies?.contact || ''}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="w-full border-collapse border border-black text-xs mb-2 table-fixed flex-grow">
          <thead>
            <tr className="bg-gray-100 text-center font-bold">
              <th className="p-1 border border-black w-8">No</th>
              <th className="p-1 border border-black w-40">품목명</th>
              <th className="p-1 border border-black w-24">규격</th>
              <th className="p-1 border border-black w-10">수량</th>
              <th className="p-1 border border-black w-20">단가</th>
              <th className="p-1 border border-black w-20">공급가액</th>
              <th className="p-1 border border-black w-20">세액</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalRows }).map((_, idx) => {
              const item = items[idx];
              
              if (!item) {
                return (
                  <tr key={`empty-${idx}`} className="text-center h-6">
                    <td className="border border-black text-transparent select-none">.</td>
                    <td className="border border-black"></td>
                    <td className="border border-black"></td>
                    <td className="border border-black"></td>
                    <td className="border border-black"></td>
                    <td className="border border-black"></td>
                    <td className="border border-black"></td>
                  </tr>
                );
              }

              const lineTotal = item.qty * item.price;
              const supply = item.is_vat_included ? Math.round(lineTotal / 1.1) : lineTotal;
              
              // === 핵심 버그 수정: 세액 0원 표기 문제 완벽 해결 ===
              const vat = item.is_vat_included ? (lineTotal - supply) : Math.floor(lineTotal * 0.1);
              
              return (
                <tr key={item.id || idx} className="text-center h-6">
                  <td className="border border-black">{idx + 1}</td>
                  <td className="border border-black text-left px-2 truncate font-bold">{item.name}</td>
                  <td className="border border-black text-left px-2 truncate text-[10px]">{item.spec || ''}</td>
                  <td className="border border-black">{item.qty}</td>
                  <td className="border border-black text-right px-1">{item.price.toLocaleString()}</td>
                  <td className="border border-black text-right px-1 font-medium">{supply.toLocaleString()}</td>
                  <td className="border border-black text-right px-1 text-gray-600">{vat.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-between items-end mt-auto pt-2 border-t-2 border-black shrink-0">
          <div className="flex items-center border border-gray-400 text-[11px] md:text-xs">
            <div className="flex items-center border-r border-gray-400">
              <span className="bg-gray-100 px-2 py-1 font-bold border-r border-gray-400">공급가액</span>
              <span className="px-2 font-medium">{invoice.supply_amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center border-r border-gray-400">
              <span className="bg-gray-100 px-2 py-1 font-bold border-r border-gray-400">세액</span>
              <span className="px-2 font-medium">{invoice.vat_amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center">
              <span className="bg-gray-200 px-2 py-1 font-bold border-r border-gray-400">합계</span>
              <span className="px-3 font-extrabold text-sm md:text-base tracking-widest text-black">￦ {invoice.total_amount.toLocaleString()}</span>
            </div>
          </div>
          <div className="text-xs font-bold flex items-center gap-2 mb-1">
            <span>인수자 :</span>
            <div className="w-20 border-b border-black"></div>
            <span>(서명/인)</span>
          </div>
        </div>

      </div>
    );
  };

  if (loading) return <div className="p-10 text-center">데이터를 불러오는 중입니다...</div>;
  if (!invoice) return <div className="p-10 text-center">해당 명세서를 찾을 수 없습니다.</div>;

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen text-black print:bg-white print:p-0 relative">
      
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 print:hidden">
          <div className="absolute inset-0 bg-transparent" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border-2 border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 whitespace-pre-line text-sm leading-relaxed">{confirmModal.desc}</p>
            <div className="flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">취소</button>
              <button onClick={confirmModal.onConfirm} className={`px-4 py-2 rounded-lg font-bold text-white transition shadow-md ${confirmModal.confirmColor}`}>
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page { size: A4 portrait; margin: 0 !important; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
            .print-container { width: 210mm; height: 297mm; padding: 12mm 15mm; box-sizing: border-box; overflow: hidden; page-break-inside: avoid; margin: 0 auto; }
            .print-half { height: 132mm; overflow: hidden; display: flex; flex-direction: column; }
            .print-cut { margin: 3mm 0; }
          }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }
          
          .custom-scrollbar::-webkit-scrollbar { height: 8px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
        `
      }} />

      <div className="max-w-4xl mx-auto mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden bg-white p-4 shadow rounded-lg">
        <button onClick={() => router.back()} className="w-full sm:w-auto bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition text-sm font-bold">
          ← 목록으로 돌아가기
        </button>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          {!isEditing ? (
            <>
              <button onClick={handleCopyInvoice} className="flex-1 sm:flex-none bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition font-bold text-sm shadow-md">
                문서 복사
              </button>
              <button onClick={startEditing} className="flex-1 sm:flex-none bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition font-bold text-sm shadow-md">
                내용 수정
              </button>
              <button onClick={handleExcelExport} className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition font-bold text-sm shadow-md">
                엑셀 다운
              </button>
              <button onClick={handlePrint} className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition font-extrabold text-sm shadow-md animate-pulse hover:animate-none">
                🖨️ 명세서 인쇄
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(false)} className="flex-1 sm:flex-none bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 transition font-bold text-sm">
                수정 취소
              </button>
              <button onClick={handleUpdate} disabled={isUpdating} className={`flex-1 sm:flex-none px-4 py-2 rounded text-white font-bold transition text-sm ${isUpdating ? 'bg-yellow-300' : 'bg-yellow-500 hover:bg-yellow-600'}`}>
                {isUpdating ? '저장 중...' : '수정 완료'}
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="max-w-4xl mx-auto bg-white p-4 md:p-8 shadow-lg border-2 border-yellow-400 rounded-lg">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-yellow-600 border-b pb-2">명세서 내용 수정</h2>
          
          <div className="mb-4 md:mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <label className="block text-sm font-bold text-gray-700 mb-2">발행 날짜 (작성일자) 변경</label>
            <input 
              type="date" 
              value={editDate} 
              onChange={(e) => setEditDate(e.target.value)} 
              className="w-full md:w-auto border border-yellow-300 rounded p-2 outline-none focus:border-yellow-500 bg-white font-bold text-gray-800" 
            />
            <p className="text-xs text-gray-500 mt-2">* 이 날짜를 기준으로 월별/연별 매출에 합산됩니다.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full mb-4 border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-100 text-left text-sm">
                  <th className="p-2 border">품목 선택 (변경 시)</th>
                  <th className="p-2 border">품명 (직접입력)</th>
                  <th className="p-2 border w-24">수량</th>
                  <th className="p-2 border w-32">단가</th>
                  <th className="p-2 border text-center w-16">관리</th>
                </tr>
              </thead>
              <tbody>
                {editItems.map((item, idx) => (
                  <tr key={idx} className="text-sm">
                    <td className="border p-2">
                      <select 
                        className="w-full outline-none bg-transparent"
                        value={item.product_id || ''}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                      >
                        <option value="">품목 변경 안함</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} {p.spec ? `(${p.spec})` : ''}</option>
                        ))}
                      </select>
                    </td>
                    <td className="border p-2">
                      <input type="text" className="w-full outline-none" 
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...editItems];
                          newItems[idx].name = e.target.value;
                          setEditItems(newItems);
                        }}
                      />
                    </td>
                    <td className="border p-2">
                      <input type="number" className="w-full outline-none text-right" 
                        value={item.qty === 0 ? '' : item.qty}
                        onChange={(e) => {
                          const newItems = [...editItems];
                          newItems[idx].qty = Number(e.target.value);
                          setEditItems(newItems);
                        }}
                      />
                    </td>
                    <td className="border p-2">
                      <input type="number" className="w-full outline-none text-right" 
                        value={item.price === 0 ? '' : item.price}
                        onChange={(e) => {
                          const newItems = [...editItems];
                          newItems[idx].price = Number(e.target.value);
                          setEditItems(newItems);
                        }}
                      />
                    </td>
                    <td className="border p-2 text-center">
                      <button onClick={() => removeEditItem(idx)} className="text-red-500 font-bold px-2 py-1 bg-red-50 rounded hover:bg-red-100">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addEditItem} className="w-full md:w-auto bg-gray-800 text-white px-6 py-3 md:py-2 rounded hover:bg-gray-700 transition font-bold text-sm">
            + 품목 줄 추가
          </button>
        </div>
      ) : (
        <div className="w-full overflow-x-auto pb-6 custom-scrollbar print:overflow-visible">
          <div className="mx-auto flex flex-col items-center print-container w-[800px] min-w-[800px] print:w-full print:min-w-0">
            <div className="w-full">
              {renderInvoiceHalf('공급자 보관용')}
              
              <div className="w-full border-b-2 border-dashed border-gray-400 relative my-4 print-cut">
                <span className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-gray-100 print:bg-white px-4 text-gray-500 font-bold text-sm">✂ 절취선 ✂</span>
              </div>

              {renderInvoiceHalf('공급받는자 보관용')}
            </div>
          </div>
        </div>
      )}

      {!isEditing && (
        <div className="max-w-4xl mx-auto mt-6 bg-white p-4 md:p-6 shadow-lg rounded-lg print:hidden border border-gray-200">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-base md:text-lg font-bold flex items-center">
              <span className="mr-2 text-xl">📎</span> 첨부파일 관리 (도면, 영수증, 문서 등)
            </h3>
            
            <label className={`cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold py-2 px-3 md:px-4 rounded border border-blue-200 transition text-sm ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isUploading ? '업로드 중...' : '+ 파일 추가'}
              <input 
                type="file" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={isUploading}
              />
            </label>
          </div>

          {attachments.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">등록된 첨부파일이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((file) => (
                <li key={file.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-100">
                  <a 
                    href={file.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm flex-1 truncate pr-4"
                  >
                    📄 {file.file_name}
                  </a>
                  <button 
                    onClick={() => handleDeleteFile(file.id, file.file_path)}
                    className="text-red-500 hover:text-red-700 font-bold text-xs bg-white px-2 py-1 rounded border border-red-200"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

    </div>
  );
}