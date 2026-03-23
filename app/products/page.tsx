"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

interface Client {
  id: string;
  name: string;
}

interface Product {
  id?: string;
  name: string;
  spec?: string | null;
  price: number;
  client_id?: string | null; // 수정: null 값 허용으로 에러 방어
  clients?: { name: string }; 
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // 폼 상태 관리
  const [formData, setFormData] = useState<Product>({ name: '', spec: '', price: 0, client_id: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  // 검색 및 페이징 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // 엑셀 업로드 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 공통 모달
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', desc: '', isAlert: true, confirmText: '확인', confirmColor: 'bg-blue-600', onConfirm: () => {}
  });

  const closeModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, desc: string, onConfirm = closeModal) => {
    setConfirmModal({ isOpen: true, title, desc, isAlert: true, confirmText: '확인', confirmColor: 'bg-blue-600', onConfirm });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile) return;

      const { data: clientsData } = await supabase.from('clients')
        .select('id, name').eq('company_id', profile.company_id).eq('is_active', true).order('name');
      if (clientsData) setClients(clientsData);

      const { data: productsData, error } = await supabase.from('products')
        .select('id, name, spec, price, client_id, clients(name)')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      
      setProducts((productsData as unknown as Product[]) || []);
      
    } catch (error) {
      const err = error as Error;
      console.error('불러오기 에러:', err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'price' ? Number(value) : value }));
  };

  const openNewProductModal = () => {
    setIsEditing(false);
    setEditId(null);
    setFormData({ name: '', spec: '', price: 0, client_id: '' });
    setShowFormModal(true);
  };

const handleSaveProduct = async () => {
    if (!formData.name.trim()) return showAlert('입력 오류', '품명을 입력해주세요.');
    if (!formData.client_id) return showAlert('입력 오류', '해당 품목의 [거래처]를 반드시 지정해주세요.');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session!.user.id).single();

      const payload = {
        name: formData.name,
        spec: formData.spec || null, // 빈칸일 경우 안전하게 null 처리
        price: formData.price,
        client_id: formData.client_id || null, // 빈칸일 경우 안전하게 null 처리
        company_id: profile!.company_id,
        is_active: true
      };

      if (isEditing && editId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editId);
        if (error) throw error;
        showAlert('수정 완료', '품목이 수정되었습니다.');
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        showAlert('등록 완료', '새 품목이 등록되었습니다.');
        setCurrentPage(1);
      }
      
      setShowFormModal(false);
      fetchData(); 
      
    } catch (error) {
      // === 핵심 수정: Supabase가 뱉어내는 진짜 에러 이유를 팝업창에 그대로 출력 ===
      const err = error as any;
      console.error('저장 에러 원본:', err);
      showAlert('저장 실패', `DB 거절 사유: \n${err?.message || String(err)}\n\n상세정보: ${err?.details || ''}`);
    }
  };
  
  const editProduct = (product: Product) => {
    setIsEditing(true);
    setEditId(product.id!);
    // === 수정: 기존 품목에 null이 있을 경우 빈 문자열로 치환하여 화면 폼 에러 방지 ===
    setFormData({ 
      name: product.name, 
      spec: product.spec || '', 
      price: product.price, 
      client_id: product.client_id || '' 
    });
    setShowFormModal(true);
  };

  const handleDeleteProduct = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true, title: '품목 삭제', desc: `'${name}' 품목을 삭제하시겠습니까?`, isAlert: false,
      confirmText: '삭제하기', confirmColor: 'bg-red-600',
      onConfirm: async () => {
        closeModal();
        try {
          const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
          if (error) throw error;
          fetchData();
        } catch (error) {
          showAlert('삭제 실패', '품목 삭제에 실패했습니다.');
        }
      }
    });
  };

  const downloadTemplate = () => {
    const templateData = [{ '거래처명(정확히입력)': '삼덕전기', '품명(필수)': '하네스 A형', '규격': '200mm', '단가': 1500 }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "품목단가양식");
    XLSX.writeFile(wb, "품목단가_일괄등록_양식.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        const mappedData = data.map((row: any) => {
          const clientName = row['거래처명(정확히입력)'] || row['거래처명'] || '';
          const matchedClient = clients.find(c => c.name === clientName);
          return {
            name: row['품명(필수)'] || row['품명'] || '',
            spec: row['규격'] || '',
            price: Number(row['단가'] || 0),
            client_id: matchedClient ? matchedClient.id : null,
            client_name: clientName, 
            is_matched: !!matchedClient
          };
        }).filter(item => item.name);

        setPreviewData(mappedData);
        setShowPreviewModal(true);
      } catch (error) { 
        showAlert('오류', '엑셀 파일을 읽는 중 오류가 발생했습니다.'); 
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmUpload = async () => {
    const validData = previewData.filter(d => d.is_matched);
    if (validData.length === 0) return showAlert('오류', '거래처가 매칭된 유효한 데이터가 없습니다.');

    try {
      setIsUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session!.user.id).single();
      
      const insertData = validData.map(item => ({ 
        company_id: profile!.company_id, name: item.name, spec: item.spec, price: item.price, client_id: item.client_id, is_active: true 
      }));
      
      const { error } = await supabase.from('products').insert(insertData);
      if (error) throw error;

      setShowPreviewModal(false);
      showAlert('완료', `${validData.length}건 등록 완료! (거래처 미매칭 ${previewData.length - validData.length}건 제외)`);
      fetchData();
    } catch (error) { 
      showAlert('오류', '저장 중 오류가 발생했습니다.'); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const displayProducts = products.filter(p => {
    const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchClient = filterClientId ? p.client_id === filterClientId : true;
    return matchName && matchClient;
  });

  const totalPages = Math.ceil(displayProducts.length / ITEMS_PER_PAGE) || 1;
  const currentProducts = displayProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black relative">
      
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4">
          <div className="absolute inset-0 bg-transparent" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border-2 border-gray-300 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 font-medium text-sm">{confirmModal.desc}</p>
            <div className="flex justify-end gap-3">
              {!confirmModal.isAlert && <button onClick={closeModal} className="px-4 py-2 rounded-lg font-bold text-gray-600 bg-gray-100 hover:bg-gray-200">취소</button>}
              <button onClick={confirmModal.onConfirm} className={`px-4 py-2 rounded-lg font-bold text-white shadow-md ${confirmModal.confirmColor}`}>{confirmModal.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {showFormModal && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-20 p-4 pointer-events-none">
          <div className="absolute inset-0 bg-transparent pointer-events-auto" onClick={() => setShowFormModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.5)] w-full max-w-lg flex flex-col animate-fade-in-up z-10 border-4 border-blue-600 pointer-events-auto">
            <div className="p-5 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-blue-900">{isEditing ? '품목/단가 수정' : '신규 품목 등록'}</h2>
              <button onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-red-500 font-bold text-3xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-blue-700 mb-1">소속 거래처 지정 *</label>
                {/* === 핵심 수정: formData.client_id가 null이어도 ""(빈칸)으로 인식하게끔 || "" 추가 === */}
                <select name="client_id" value={formData.client_id || ""} onChange={handleInputChange} className="w-full border-2 border-blue-200 rounded-lg p-3 outline-none focus:border-blue-600 font-bold bg-blue-50 text-gray-800">
                  <option value="">거래처를 선택하세요</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1 font-bold">* 명세서 작성 시 여기서 지정한 거래처에서만 이 품목이 검색됩니다.</p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">품명 *</label>
                <input type="text" name="name" value={formData.name || ""} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 font-bold" placeholder="품목 이름 입력" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">규격</label>
                <input type="text" name="spec" value={formData.spec || ""} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="규격 입력 (선택)" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">단가 (원) *</label>
                <input type="number" name="price" value={formData.price || ''} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 font-bold text-blue-700 text-right" placeholder="0" />
              </div>
            </div>
            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setShowFormModal(false)} className="px-5 py-2.5 rounded-lg font-bold text-gray-600 bg-white border hover:bg-gray-100">취소</button>
              <button onClick={handleSaveProduct} className={`px-6 py-2.5 rounded-lg font-bold text-white shadow-md ${isEditing ? 'bg-yellow-500' : 'bg-blue-600'}`}>
                {isEditing ? '정보 수정하기' : '새 품목 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center pt-20 p-4 pointer-events-none">
          <div className="absolute inset-0 bg-transparent pointer-events-auto" onClick={() => setShowPreviewModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.5)] w-full max-w-4xl flex flex-col max-h-[75vh] animate-fade-in-up z-10 border-4 border-blue-600 pointer-events-auto">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
              <h3 className="text-xl font-extrabold text-blue-800">품목 엑셀 업로드 미리보기</h3>
              <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-red-500 font-bold text-3xl leading-none">&times;</button>
            </div>
            <div className="p-4 overflow-auto flex-grow">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-200 text-left border-y border-gray-300">
                    <th className="p-2 border-x w-32 font-bold text-blue-700">거래처명 (매칭)</th>
                    <th className="p-2 border-x font-bold">품명</th>
                    <th className="p-2 border-x w-32">규격</th>
                    <th className="p-2 border-x w-24 text-right">단가</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((item, idx) => (
                    <tr key={idx} className={`border-b ${item.is_matched ? 'hover:bg-blue-50' : 'bg-red-50 text-red-500'}`}>
                      <td className="p-2 border-x font-bold">
                        {item.client_name} {item.is_matched ? '✅' : '(미등록 ❌)'}
                      </td>
                      <td className="p-2 border-x font-bold">{item.name}</td>
                      <td className="p-2 border-x">{item.spec}</td>
                      <td className="p-2 border-x text-right font-bold">{item.price.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-red-500 font-bold mt-3">* 미등록(❌)으로 표시된 거래처의 품목은 업로드에서 제외됩니다. 거래처 관리에 먼저 거래처를 등록하세요.</p>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl shrink-0">
              <button onClick={() => setShowPreviewModal(false)} className="px-6 py-2 rounded-lg font-bold text-gray-700 bg-white border border-gray-300">취소</button>
              <button onClick={confirmUpload} disabled={isUploading} className={`px-6 py-2 rounded-lg font-bold text-white shadow-md ${isUploading ? 'bg-blue-400' : 'bg-blue-600'}`}>
                {isUploading ? '저장 중...' : '매칭 성공건만 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }` }} />

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        
        <div className="w-full lg:w-1/4 space-y-4">
          <div className="bg-white p-5 md:p-6 shadow-lg rounded-lg border-t-4 border-blue-600 sticky top-6">
            <div className="mb-6 border-b pb-4">
              <h1 className="text-xl md:text-2xl font-bold">품목/단가 관리</h1>
              <p className="text-gray-500 text-sm mt-1">총 {displayProducts.length}개 품목</p>
            </div>
            
            <div className="flex flex-col gap-3">
              <button onClick={openNewProductModal} className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition font-extrabold text-sm shadow-md flex items-center justify-center gap-2">
                <span className="text-lg">+</span> 신규 품목 등록
              </button>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">거래처별 보기</label>
                  <select 
                    value={filterClientId} 
                    onChange={(e) => { setFilterClientId(e.target.value); setCurrentPage(1); }}
                    className="w-full border-2 border-blue-200 rounded-lg p-2.5 outline-none focus:border-blue-600 bg-white font-bold text-gray-700"
                  >
                    <option value="">전체 거래처 보기</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">품명 검색</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 font-bold placeholder-gray-400"
                    placeholder="🔍 품명 입력..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </div>

              <div className="h-px bg-gray-200 my-2"></div>
              <button onClick={downloadTemplate} className="w-full bg-green-50 text-green-700 border border-green-200 p-3 rounded-lg hover:bg-green-100 font-bold text-sm">
                ⬇️ 엑셀 빈 양식 다운
              </button>
              <label className="w-full cursor-pointer bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 font-bold text-sm text-center shadow-md block">
                ⬆️ 일괄 업로드 (엑셀)
                <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-3/4">
          <div className="bg-white p-4 md:p-6 shadow-lg rounded-lg min-h-[500px] flex flex-col">
            
            {loading ? (
              <div className="flex-grow flex items-center justify-center"><p className="font-bold text-gray-500">데이터를 불러오는 중입니다...</p></div>
            ) : displayProducts.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 p-10">
                <p className="text-gray-500 mb-2 font-bold">등록되거나 검색된 품목이 없습니다.</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto flex-grow">
                  <table className="w-full border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-100 text-left text-sm border-y-2 border-gray-300">
                        <th className="p-3 w-16 text-center">No</th>
                        <th className="p-3 w-40 font-bold text-blue-700">소속 거래처명</th>
                        <th className="p-3 w-64">품명</th>
                        <th className="p-3 w-32">규격</th>
                        <th className="p-3 w-32 text-right">단가</th>
                        <th className="p-3 text-center w-36">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentProducts.map((product, idx) => {
                        const actualIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                        return (
                          <tr key={product.id} className="border-b hover:bg-blue-50 text-sm transition">
                            <td className="p-3 text-center text-gray-400 font-bold">{actualIndex}</td>
                            <td className="p-3 font-extrabold text-blue-800">{product.clients?.name || '미지정'}</td>
                            <td className="p-3 font-extrabold text-gray-900">{product.name}</td>
                            <td className="p-3 font-medium text-gray-600">{product.spec || '-'}</td>
                            <td className="p-3 text-right font-bold text-blue-700">{product.price.toLocaleString()}원</td>
                            <td className="p-3 text-center space-x-1 whitespace-nowrap">
                              <button onClick={() => editProduct(product)} className="text-blue-600 font-bold px-3 py-1.5 bg-white border border-blue-200 rounded hover:bg-blue-50 text-xs shadow-sm">수정</button>
                              <button onClick={() => handleDeleteProduct(product.id!, product.name)} className="text-red-500 font-bold px-2 py-1.5 bg-white border border-red-200 rounded hover:bg-red-50 text-xs">삭제</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-4 flex-grow">
                  {currentProducts.map((product, idx) => (
                    <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative border-l-4 border-l-blue-500">
                      <div className="text-xs font-extrabold text-blue-600 mb-1">{product.clients?.name || '미지정 거래처'}</div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-extrabold text-lg text-gray-900">{product.name}</h3>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1 mb-3">
                        <p><span className="font-bold w-12 inline-block text-gray-500">규격:</span> {product.spec || '-'}</p>
                        <p><span className="font-bold w-12 inline-block text-gray-500">단가:</span> <span className="font-extrabold text-blue-700">{product.price.toLocaleString()}원</span></p>
                      </div>
                      <div className="flex gap-2 justify-end border-t border-dashed pt-3 mt-2">
                        <button onClick={() => editProduct(product)} className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-sm font-bold">수정</button>
                        <button onClick={() => handleDeleteProduct(product.id!, product.name)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold">삭제</button>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-6 pt-4 flex justify-center items-center gap-2 border-t border-gray-200 shrink-0">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`px-3 py-1.5 rounded font-bold text-sm ${currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>이전</button>
                    <div className="flex gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-8 h-8 shrink-0 rounded font-bold text-sm flex items-center justify-center transition-colors ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-md' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>{i + 1}</button>
                      ))}
                    </div>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`px-3 py-1.5 rounded font-bold text-sm ${currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>다음</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}