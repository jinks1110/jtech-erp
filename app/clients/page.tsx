"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

interface Client {
  id?: string;
  name: string;
  business_number: string;
  ceo_name: string;
  address: string;
  contact: string;
  email: string;
  fax: string;
  business_type: string;     
  business_category: string; 
  bank_account: string;      
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // 수동 입력 및 수정 폼 상태
  const [formData, setFormData] = useState<Client>({
    name: '', business_number: '', ceo_name: '', address: '', contact: '', email: '', fax: '', business_type: '', business_category: '', bank_account: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // 엑셀 업로드 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 공통 커스텀 모달창 (pt-20 적용)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', desc: '', isAlert: true, confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm: () => {}
  });

  const closeModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, desc: string, onConfirm = closeModal) => {
    setConfirmModal({ isOpen: true, title, desc, isAlert: true, confirmText: '확인', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm });
  };

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile) return;

      const { data, error } = await supabase.from('clients').select('*').eq('company_id', profile.company_id).eq('is_active', true).order('name', { ascending: true });
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('거래처 불러오기 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveClient = async () => {
    if (!formData.name.trim()) {
      showAlert('입력 오류', '거래처명은 필수 입력 항목입니다.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인 필요');
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();

      if (isEditing && editId) {
        const { error } = await supabase.from('clients').update({ ...formData }).eq('id', editId);
        if (error) throw error;
        showAlert('수정 완료', '거래처 정보가 수정되었습니다.');
      } else {
        const { error } = await supabase.from('clients').insert([{ ...formData, company_id: profile!.company_id, is_active: true }]);
        if (error) throw error;
        showAlert('등록 완료', '새 거래처가 등록되었습니다.');
      }
      
      resetForm();
      fetchClients();
    } catch (error: any) {
      showAlert('저장 실패', '거래처 저장에 실패했습니다.');
    }
  };

  const editClient = (client: Client) => {
    setIsEditing(true);
    setEditId(client.id!);
    setFormData({
      name: client.name || '', business_number: client.business_number || '', ceo_name: client.ceo_name || '',
      address: client.address || '', contact: client.contact || '', email: client.email || '', fax: client.fax || '',
      business_type: client.business_type || '', business_category: client.business_category || '', bank_account: client.bank_account || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setIsEditing(false); setEditId(null);
    setFormData({ name: '', business_number: '', ceo_name: '', address: '', contact: '', email: '', fax: '', business_type: '', business_category: '', bank_account: '' });
  };

  const handleDeleteClient = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true, title: '거래처 삭제', desc: `정말 '${name}' 거래처를 삭제하시겠습니까?`, isAlert: false,
      confirmText: '삭제하기', confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        closeModal();
        try {
          const { error } = await supabase.from('clients').update({ is_active: false }).eq('id', id);
          if (error) throw error;
          fetchClients();
        } catch (error) {
          showAlert('삭제 실패', '거래처 삭제에 실패했습니다.');
        }
      }
    });
  };

  const downloadTemplate = () => {
    const templateData = [{
      '거래처명(필수)': '제이테크', '사업자번호': '123-45-67890', '대표자명': '진경섭', 
      '업태': '제조업', '종목': '와이어하네스', '주소': '경기도 시흥시 수풀안길 9-36 1002호', 
      '연락처': '010-0000-0000', '이메일': 'Jtech1110@gmail.com', '팩스': '031-000-0000', '계좌번호': '국민 123456-78-901234'
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "거래처등록양식");
    XLSX.writeFile(wb, "거래처_일괄등록_양식.xlsx");
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

        if (data.length === 0) { showAlert('업로드 오류', '엑셀 파일에 데이터가 없습니다.'); return; }

        const mappedData = data.map((row: any) => ({
          name: row['거래처명(필수)'] || row['거래처명'] || row['상호명'] || '',
          business_number: String(row['사업자번호'] || row['등록번호'] || ''),
          ceo_name: row['대표자명'] || row['성명'] || '',
          business_type: row['업태'] || '',
          business_category: row['종목'] || '',
          address: row['주소'] || row['사업장주소'] || '',
          contact: String(row['연락처'] || row['전화번호'] || ''),
          email: row['이메일'] || '',
          fax: String(row['팩스'] || ''),
          bank_account: String(row['계좌번호'] || row['계좌'] || '')
        })).filter(item => item.name);

        if (mappedData.length === 0) { showAlert('업로드 오류', '유효한 데이터가 없습니다.'); return; }

        setPreviewData(mappedData);
        setShowPreviewModal(true);
      } catch (error) { showAlert('업로드 오류', '엑셀 파일을 읽는 중 오류가 발생했습니다.'); }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

const confirmUpload = async () => {
    try {
      setIsUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인 세션 없음');
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      
      const insertData = previewData.map(item => ({ ...item, company_id: profile!.company_id, is_active: true }));
      const { error } = await supabase.from('clients').insert(insertData);
      if (error) throw error; // 여기서 DB 에러가 발생합니다.

      setShowPreviewModal(false);
      showAlert('등록 완료', `총 ${previewData.length}개의 거래처가 일괄 등록되었습니다.`);
      fetchClients();
    } catch (error: any) { 
      // === 여기를 바꿨습니다: 진짜 에러 메시지를 띄워줍니다! ===
      showAlert('DB 등록 실패', '에러 원인: ' + (error.message || error.details)); 
      console.error("업로드 에러 상세:", error);
    }
    finally { setIsUploading(false); }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black relative">
      
      {/* 공통 커스텀 모달 (pt-20 적용) */}
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

      {/* 엑셀 미리보기 모달 */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center pt-20 p-4">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => setShowPreviewModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[75vh] animate-fade-in-up z-10 border border-gray-200">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
              <div>
                <h3 className="text-xl font-extrabold text-blue-800">엑셀 업로드 미리보기</h3>
                <p className="text-sm text-gray-600 font-bold mt-1">총 {previewData.length}건 확인 완료</p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-red-500 font-bold text-2xl">×</button>
            </div>
            <div className="p-4 overflow-auto flex-grow">
              {/* === 수정: 테이블 너비 확보 및 연락처, 이메일 열 추가 === */}
              <table className="w-full border-collapse text-xs md:text-sm min-w-[1200px]">
                <thead>
                  <tr className="bg-gray-200 text-left border-y border-gray-300">
                    <th className="p-2 border-x w-10 text-center">No</th>
                    <th className="p-2 border-x w-32 font-bold text-blue-700">거래처명</th>
                    <th className="p-2 border-x w-24">사업자번호</th>
                    <th className="p-2 border-x w-20">업태</th>
                    <th className="p-2 border-x w-20">종목</th>
                    <th className="p-2 border-x w-24">대표자명</th>
                    <th className="p-2 border-x w-32">연락처</th>
                    <th className="p-2 border-x w-40">이메일</th>
                    <th className="p-2 border-x">사업장주소</th>
                    <th className="p-2 border-x w-32">계좌정보</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-blue-50">
                      <td className="p-2 border-x text-center text-gray-500">{idx + 1}</td>
                      <td className="p-2 border-x font-bold">{item.name}</td>
                      <td className="p-2 border-x">{item.business_number}</td>
                      <td className="p-2 border-x">{item.business_type}</td>
                      <td className="p-2 border-x">{item.business_category}</td>
                      <td className="p-2 border-x">{item.ceo_name}</td>
                      {/* === 수정: 연락처와 이메일 데이터 매핑 === */}
                      <td className="p-2 border-x">{item.contact}</td>
                      <td className="p-2 border-x truncate max-w-[150px]">{item.email}</td>
                      <td className="p-2 border-x truncate max-w-[150px]">{item.address}</td>
                      <td className="p-2 border-x truncate max-w-[150px]">{item.bank_account}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl shrink-0">
              <button onClick={() => setShowPreviewModal(false)} className="px-6 py-2 rounded-lg font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100">취소</button>
              <button onClick={confirmUpload} disabled={isUploading} className={`px-6 py-2 rounded-lg font-bold text-white shadow-md ${isUploading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isUploading ? '저장 중...' : 'DB에 저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }` }} />

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 상단: 타이틀 및 엑셀 버튼 그룹 */}
        <div className="bg-white p-4 md:p-6 shadow-lg rounded-lg border-t-4 border-blue-600 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">거래처 관리</h1>
            <p className="text-gray-500 text-sm mt-1">거래처 정보 수동 등록 및 엑셀 일괄 업로드</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={downloadTemplate} className="flex-1 md:flex-none bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded hover:bg-green-100 transition font-bold text-sm">
              ⬇️ 엑셀 빈 양식 다운
            </button>
            <label className="flex-1 md:flex-none cursor-pointer bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition font-bold text-sm text-center shadow-md">
              ⬆️ 엑셀 일괄 업로드
              <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        {/* 수동 입력 폼 */}
        <div className={`bg-white p-4 md:p-6 shadow-lg rounded-lg border-2 ${isEditing ? 'border-yellow-400' : 'border-transparent'}`}>
          <h2 className="text-lg font-bold mb-4">{isEditing ? '거래처 정보 수정' : '신규 거래처 직접 등록'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">상호(명) *</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 font-bold" placeholder="예: (주)제이테크" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">사업자번호</label><input type="text" name="business_number" value={formData.business_number} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="123-45-67890" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">대표자명</label><input type="text" name="ceo_name" value={formData.ceo_name} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="홍길동" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">연락처</label><input type="text" name="contact" value={formData.contact} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="010-0000-0000" /></div>
            
            <div><label className="block text-sm font-bold text-gray-700 mb-1">업태</label><input type="text" name="business_type" value={formData.business_type} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="제조업 등" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">종목</label><input type="text" name="business_category" value={formData.business_category} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="와이어하네스 등" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">결제 계좌번호</label><input type="text" name="bank_account" value={formData.bank_account} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="은행 및 계좌번호 입력" /></div>

            <div className="md:col-span-4"><label className="block text-sm font-bold text-gray-700 mb-1">사업장 주소</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="전체 주소 입력" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">이메일</label><input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="email@example.com" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">팩스번호</label><input type="text" name="fax" value={formData.fax} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500" placeholder="02-000-0000" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            {isEditing && <button onClick={resetForm} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-lg font-bold hover:bg-gray-200 transition">취소</button>}
            <button onClick={handleSaveClient} className={`${isEditing ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-8 py-2 rounded-lg font-bold transition shadow-md`}>
              {isEditing ? '수정 완료' : '신규 등록'}
            </button>
          </div>
        </div>

        {/* 리스트 뷰 */}
        <div className="bg-white p-4 md:p-6 shadow-lg rounded-lg">
          <h2 className="text-lg font-bold mb-4">등록된 거래처 목록</h2>
          {loading ? (
            <p className="text-center py-10 text-gray-500 font-bold">불러오는 중...</p>
          ) : clients.length === 0 ? (
            <p className="text-center py-10 text-gray-500">등록된 거래처가 없습니다.</p>
          ) : (
            <>
              {/* 데스크탑 뷰 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left text-sm border-y-2 border-gray-300">
                      <th className="p-3">상호(명)</th>
                      <th className="p-3">사업자번호</th>
                      <th className="p-3">업태/종목</th>
                      <th className="p-3">연락처</th>
                      <th className="p-3">이메일</th>
                      <th className="p-3">계좌정보</th>
                      <th className="p-3 text-center w-32">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(client => (
                      <tr key={client.id} className="border-b hover:bg-gray-50 text-sm transition">
                        <td className="p-3 font-bold text-blue-800 whitespace-nowrap">{client.name}</td>
                        <td className="p-3 whitespace-nowrap">{client.business_number || '-'}</td>
                        <td className="p-3 whitespace-nowrap text-xs text-gray-600">
                          {client.business_type || '-'}<br/>{client.business_category || '-'}
                        </td>
                        <td className="p-3 whitespace-nowrap">{client.contact || '-'}</td>
                        <td className="p-3 whitespace-nowrap text-gray-600">{client.email || '-'}</td>
                        <td className="p-3 truncate max-w-[150px]" title={client.bank_account}>{client.bank_account || '-'}</td>
                        <td className="p-3 text-center space-x-1 whitespace-nowrap">
                          <button onClick={() => editClient(client)} className="text-blue-600 font-bold px-2 py-1 bg-white border border-blue-200 rounded hover:bg-blue-50 transition text-xs">수정</button>
                          <button onClick={() => handleDeleteClient(client.id!, client.name)} className="text-red-500 font-bold px-2 py-1 bg-white border border-red-200 rounded hover:bg-red-50 transition text-xs">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 모바일 카드 뷰 */}
              <div className="md:hidden space-y-4">
                {clients.map(client => (
                  <div key={client.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative">
                    <h3 className="font-extrabold text-lg text-blue-800 mb-1">{client.name}</h3>
                    <div className="text-sm text-gray-600 space-y-1 mb-3">
                      <p><span className="font-bold w-20 inline-block">사업자번호:</span> {client.business_number || '-'}</p>
                      <p><span className="font-bold w-20 inline-block">연락처:</span> {client.contact || '-'}</p>
                      <p><span className="font-bold w-20 inline-block">이메일:</span> <span className="truncate inline-block align-bottom max-w-[180px]">{client.email || '-'}</span></p>
                      <p><span className="font-bold w-20 inline-block">계좌:</span> <span className="truncate inline-block align-bottom max-w-[200px]">{client.bank_account || '-'}</span></p>
                    </div>
                    <div className="flex gap-2 justify-end border-t border-dashed pt-3 mt-2">
                      <button onClick={() => editClient(client)} className="bg-blue-50 text-blue-600 border border-blue-200 px-4 py-1.5 rounded text-sm font-bold">수정</button>
                      <button onClick={() => handleDeleteClient(client.id!, client.name)} className="bg-red-50 text-red-600 border border-red-200 px-4 py-1.5 rounded text-sm font-bold">삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}