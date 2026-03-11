"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

interface InvoiceDetail {
  id: string;
  invoice_no: string;
  issue_date: string;
  supply_amount: number;
  vat_amount: number;
  total_amount: number;
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

// === 신규 추가: 첨부파일 타입 ===
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
  const [isUpdating, setIsUpdating] = useState(false);

  // === 신규 추가: 첨부파일 상태 ===
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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
        console.error("프로필 정보 없음:", profileError);
        throw new Error('회사 정보를 불러오는데 실패했습니다.');
      }

      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select(`
          *,
          clients (name, business_number, address, contact),
          companies (name, business_number)
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

      // === 신규 추가: 첨부파일 목록 불러오기 ===
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
      console.error('엑셀 변환 에러:', error.message);
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const startEditing = () => {
    setIsEditing(true);
    setEditItems([...items]); 
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
      console.error('수정 에러:', error.message);
      alert('수정에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  // === 신규 추가: 파일 업로드 핸들러 ===
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      
      setIsUploading(true);

      // 1. Storage에 파일 업로드 (이름 충돌 방지를 위해 현재 시간 추가)
      const fileExt = file.name.split('.').pop();
      const fileName = `${invoiceId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. 업로드된 파일의 공개 URL 가져오기
      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      // 3. DB 테이블에 기록 저장
      const { error: dbError } = await supabase
        .from('attachments')
        .insert([{
          invoice_id: invoiceId,
          file_name: file.name,
          file_path: filePath,
          file_url: urlData.publicUrl
        }]);

      if (dbError) throw dbError;

      // 목록 새로고침
      fetchInvoiceDetail();
      alert('파일이 성공적으로 첨부되었습니다.');

    } catch (error: any) {
      console.error("업로드 에러:", error.message);
      alert('파일 업로드에 실패했습니다. (Storage 버킷을 생성했는지 확인해주세요.)');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // input 초기화
    }
  };

  // === 신규 추가: 파일 삭제 핸들러 ===
  const handleDeleteFile = async (id: string, filePath: string) => {
    if (!window.confirm('첨부파일을 삭제하시겠습니까?')) return;

    try {
      // 1. Storage에서 삭제
      await supabase.storage.from('attachments').remove([filePath]);
      // 2. DB에서 삭제
      const { error } = await supabase.from('attachments').delete().eq('id', id);
      if (error) throw error;

      fetchInvoiceDetail(); // 목록 새로고침
    } catch (error: any) {
      alert('파일 삭제에 실패했습니다.');
    }
  };

  if (loading) return <div className="p-10 text-center">데이터를 불러오는 중입니다...</div>;
  if (!invoice) return <div className="p-10 text-center">해당 명세서를 찾을 수 없습니다.</div>;

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen text-black print:bg-white print:p-0">
      
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page { size: A4 portrait; margin: 15mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
            table { page-break-inside: auto; }
            tr    { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          }
        `
      }} />

      {/* 상단: 컨트롤 버튼 */}
      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center print:hidden bg-white p-4 shadow rounded-lg">
        <button onClick={() => router.back()} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition text-sm">
          ← 목록으로 돌아가기
        </button>
        <div className="space-x-2">
          {!isEditing ? (
            <>
              <button onClick={startEditing} className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition font-bold text-sm">
                내용 수정하기
              </button>
              <button onClick={handleExcelExport} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition font-bold text-sm">
                엑셀(.xlsx) 다운로드
              </button>
              <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition font-bold text-sm">
                명세서 인쇄 (PDF)
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(false)} className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 transition font-bold text-sm">
                수정 취소
              </button>
              <button onClick={handleUpdate} disabled={isUpdating} className={`px-4 py-2 rounded text-white font-bold transition text-sm ${isUpdating ? 'bg-yellow-300' : 'bg-yellow-500 hover:bg-yellow-600'}`}>
                {isUpdating ? '저장 중...' : '수정 완료 및 DB 저장'}
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg border-2 border-yellow-400 rounded-lg">
          <h2 className="text-2xl font-bold mb-6 text-yellow-600 border-b pb-2">명세서 내용 수정 (문서번호: {invoice.invoice_no})</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full mb-4 border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-100 text-left text-sm">
                  <th className="p-2 border">품목 선택 (변경 시)</th>
                  <th className="p-2 border">품명 (직접입력)</th>
                  <th className="p-2 border">수량</th>
                  <th className="p-2 border">단가</th>
                  <th className="p-2 border text-center">관리</th>
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
          <button onClick={addEditItem} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition text-sm">
            + 품목 줄 추가
          </button>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg print:shadow-none print:max-w-none print:p-0">
          <h1 className="text-3xl font-bold text-center mb-8 tracking-widest underline underline-offset-8 decoration-2">거래명세표</h1>
          
          <div className="flex justify-between mb-8 border-b-2 border-black pb-4">
            <div className="w-1/2 pr-4">
              <h2 className="font-bold text-lg mb-2">공급받는자</h2>
              <p className="mb-1"><span className="font-semibold w-20 inline-block">상호:</span> {invoice.clients?.name}</p>
              <p className="mb-1"><span className="font-semibold w-20 inline-block">사업자번호:</span> {invoice.clients?.business_number || '-'}</p>
              <p className="mb-1"><span className="font-semibold w-20 inline-block">주소:</span> {invoice.clients?.address || '-'}</p>
              <p className="mb-1"><span className="font-semibold w-20 inline-block">연락처:</span> {invoice.clients?.contact || '-'}</p>
            </div>
            <div className="w-1/2 pl-4 border-l-2 border-gray-300">
              <h2 className="font-bold text-lg mb-2">공급자</h2>
              <p className="mb-1"><span className="font-semibold w-20 inline-block">상호:</span> {invoice.companies?.name}</p>
              <p className="mb-1"><span className="font-semibold w-20 inline-block">사업자번호:</span> {invoice.companies?.business_number || '-'}</p>
              <p className="mb-1"><span className="font-semibold w-20 inline-block">발행일자:</span> {invoice.issue_date}</p>
              <p className="mb-1"><span className="font-semibold w-20 inline-block">문서번호:</span> {invoice.invoice_no}</p>
            </div>
          </div>

          <table className="w-full mb-8 border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100 text-center font-bold">
                <th className="p-2 border border-black w-1/12">No.</th>
                <th className="p-2 border border-black w-4/12">품명</th>
                <th className="p-2 border border-black w-2/12">규격</th>
                <th className="p-2 border border-black w-1/12">수량</th>
                <th className="p-2 border border-black w-2/12">단가</th>
                <th className="p-2 border border-black w-2/12">공급가액</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="text-sm">
                  <td className="p-2 border border-black text-center">{idx + 1}</td>
                  <td className="p-2 border border-black">{item.name}</td>
                  <td className="p-2 border border-black text-center">{item.spec || '-'}</td>
                  <td className="p-2 border border-black text-center">{item.qty}</td>
                  <td className="p-2 border border-black text-right">{item.price.toLocaleString()}</td>
                  <td className="p-2 border border-black text-right font-medium">{(item.qty * item.price).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end border-t-2 border-black pt-4">
            <div className="w-1/2">
              <div className="flex justify-between mb-2">
                <span className="font-bold">공급가액:</span>
                <span>{invoice.supply_amount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="font-bold">부가세:</span>
                <span>{invoice.vat_amount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between mt-4 pt-2 border-t border-gray-400 text-xl">
                <span className="font-extrabold">총 청구액:</span>
                <span className="font-extrabold text-blue-800">{invoice.total_amount.toLocaleString()}원</span>
              </div>
            </div>
          </div>
          
        </div>
      )}

      {/* === 신규 추가: 첨부파일 관리 영역 (인쇄 시 숨김) === */}
      {!isEditing && (
        <div className="max-w-4xl mx-auto mt-6 bg-white p-6 shadow-lg rounded-lg print:hidden border border-gray-200">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-lg font-bold flex items-center">
              <span className="mr-2 text-xl">📎</span> 첨부파일 관리 (도면, 영수증, 문서 등)
            </h3>
            
            {/* 파일 업로드 버튼 */}
            <label className={`cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold py-2 px-4 rounded border border-blue-200 transition ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isUploading ? '업로드 중...' : '+ 파일 추가'}
              <input 
                type="file" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={isUploading}
              />
            </label>
          </div>

          {/* 첨부파일 리스트 */}
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