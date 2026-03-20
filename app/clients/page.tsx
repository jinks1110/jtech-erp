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
  
  const [showFormModal, setShowFormModal] = useState(false);

  // === 신규: 왼쪽 패널 검색 상태 관리 ===
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedSearchClientId, setSelectedSearchClientId] = useState<string | null>(null);
  const [showClientSearchDropdown, setShowClientSearchDropdown] = useState(false);
  const clientSearchWrapperRef = useRef<HTMLDivElement>(null);

  // 페이징(페이지네이션) 상태 관리
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10; 

  // 엑셀 업로드 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 공통 커스텀 모달창
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

  // 외부 클릭 시 검색 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSearchWrapperRef.current && !clientSearchWrapperRef.current.contains(event.target as Node)) {
        setShowClientSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // === 신규: 자동 하이픈(-) 포맷팅 함수 ===
  const formatBusinessNumber = (value: string) => {
    const v = value.replace(/\D/g, ""); // 숫자만 추출
    const match = v.match(/^(\d{0,3})(\d{0,2})(\d{0,5})$/);
    if (!match) return v;
    if (match[3]) return `${match[1]}-${match[2]}-${match[3]}`;
    if (match[2]) return `${match[1]}-${match[2]}`;
    return match[1];
  };

  const formatPhoneNumber = (value: string) => {
    const v = value.replace(/\D/g, ""); // 숫자만 추출
    if (v.startsWith("02")) {
      const match = v.match(/^(\d{0,2})(\d{0,4})(\d{0,4})$/);
      if (!match) return v;
      if (match[3]) return `${match[1]}-${match[2]}-${match[3]}`;
      if (match[2]) return `${match[1]}-${match[2]}`;
      return match[1];
    } else {
      const match = v.match(/^(\d{0,3})(\d{0,4})(\d{0,4})$/);
      if (!match) return v;
      if (match[3]) return `${match[1]}-${match[2]}-${match[3]}`;
      if (match[2]) return `${match[1]}-${match[2]}`;
      return match[1];
    }
  };

  // === 수정: 입력 시 자동 포맷팅 적용 ===
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'business_number') {
      formattedValue = formatBusinessNumber(value);
    } else if (name === 'contact' || name === 'fax') {
      formattedValue = formatPhoneNumber(value);
    }

    setFormData({ ...formData, [name]: formattedValue });
  };

  const openNewClientModal = () => {
    setIsEditing(false);
    setEditId(null);
    setFormData({ name: '', business_number: '', ceo_name: '', address: '', contact: '', email: '', fax: '', business_type: '', business_category: '', bank_account: '' });
    setShowFormModal(true);
  };

  const handleSaveClient = async () => {
    if (!formData.name.trim()) {
      showAlert('입력 오류', '상호(명)은 필수 입력 항목입니다.');
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
        setCurrentPage(1); 
      }
      
      setShowFormModal(false);
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
    setShowFormModal(true);
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
      if (error) throw error;

      setShowPreviewModal(false);
      showAlert('등록 완료', `총 ${previewData.length}개의 거래처가 일괄 등록되었습니다.`);
      fetchClients();
    } catch (error: any) { showAlert('등록 실패', 'DB 저장 중 오류가 발생했습니다.'); }
    finally { setIsUploading(false); }
  };

  // === 신규: 왼쪽 패널 검색 기능 적용 필터링 ===
  const filteredSearchClients = clients.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()));

  // 검색/필터 적용된 전체 리스트
  const displayClients = clients.filter(c => {
    if (selectedSearchClientId) return c.id === selectedSearchClientId;
    if (clientSearchTerm) return c.name.toLowerCase().includes(clientSearchTerm.toLowerCase());
    return true;
  });

  // 페이징 계산
  const totalPages = Math.ceil(displayClients.length / ITEMS_PER_PAGE) || 1;
  const currentClients = displayClients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black relative">
      
      {/* 공통 커스텀 모달 (검은 화면 제거: bg-transparent 적용) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 print:hidden">
          <div className="absolute inset-0 bg-transparent" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border-2 border-gray-300 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6 whitespace-pre-line text-sm leading-relaxed">{confirmModal.desc}</p>
            <div className="flex justify-end gap-3">
              {!confirmModal.isAlert && <button onClick={closeModal} className="px-4 py-2 rounded-lg font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">취소</button>}
              <button onClick={confirmModal.onConfirm} className={`px-4 py-2 rounded-lg font-bold text-white transition shadow-md ${confirmModal.confirmColor}`}>{confirmModal.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {/* 거래처 작성/수정 팝업 모달창 (검은 배경 제거) */}
      {showFormModal && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-10 md:pt-20 p-4 pointer-events-none">
          <div className="absolute inset-0 bg-transparent pointer-events-auto" onClick={() => setShowFormModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.5)] w-full max-w-4xl flex flex-col max-h-[85vh] animate-fade-in-up z-10 border-4 border-blue-600 pointer-events-auto">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
              <h2 className="text-xl font-extrabold text-blue-900">{isEditing ? '거래처 상세 정보 (수정)' : '신규 거래처 직접 등록'}</h2>
              <button onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-red-500 font-bold text-3xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">상호(명) *</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none focus:border-blue-500 font-bold bg-blue-50" placeholder="예: (주)제이테크" /></div>
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
            </div>

            <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl shrink-0">
              <button onClick={() => setShowFormModal(false)} className="px-6 py-2.5 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition">취소</button>
              <button onClick={handleSaveClient} className={`px-8 py-2.5 rounded-lg font-bold text-white transition shadow-md ${isEditing ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isEditing ? '정보 수정하기' : '새 거래처 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 엑셀 미리보기 모달 (검은 배경 제거) */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center pt-20 p-4 pointer-events-none">
          <div className="absolute inset-0 bg-transparent pointer-events-auto" onClick={() => setShowPreviewModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.5)] w-full max-w-6xl flex flex-col max-h-[75vh] animate-fade-in-up z-10 border-4 border-blue-600 pointer-events-auto">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
              <div>
                <h3 className="text-xl font-extrabold text-blue-800">엑셀 업로드 미리보기</h3>
                <p className="text-sm text-gray-600 font-bold mt-1">총 {previewData.length}건 확인 완료</p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-red-500 font-bold text-3xl leading-none">&times;</button>
            </div>
            <div className="p-4 overflow-auto flex-grow">
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

      <div className="max-w-7xl mx-auto">
        {/* 좌우 분할 레이아웃 유지 */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* 왼쪽 패널: 컨트롤 박스 */}
          <div className="w-full lg:w-1/4 space-y-4">
            <div className="bg-white p-5 md:p-6 shadow-lg rounded-lg border-t-4 border-blue-600 sticky top-6">
              <div className="mb-6 border-b pb-4">
                <h1 className="text-xl md:text-2xl font-bold">거래처 관리</h1>
                <p className="text-gray-500 text-sm mt-1">총 {displayClients.length}건 검색됨</p>
              </div>
              
              <div className="flex flex-col gap-3">
                <button onClick={openNewClientModal} className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition font-extrabold text-sm shadow-md flex items-center justify-center gap-2">
                  <span className="text-lg">+</span> 신규 등록하기
                </button>

                {/* === 신규: 왼쪽 패널 상호명 검색 (자동완성) === */}
                <div className="mt-4 relative" ref={clientSearchWrapperRef}>
                  <label className="block text-sm font-bold text-gray-700 mb-1">상호명 검색</label>
                  <input
                    type="text"
                    className="w-full border-2 border-blue-300 rounded-lg p-2.5 outline-none focus:border-blue-600 bg-white font-bold placeholder-gray-400"
                    placeholder="🔍 거래처명 입력..."
                    value={clientSearchTerm}
                    onChange={(e) => {
                      setClientSearchTerm(e.target.value);
                      setShowClientSearchDropdown(true);
                      if (e.target.value === '') setSelectedSearchClientId(null);
                      setCurrentPage(1); // 검색 시 1페이지로 리셋
                    }}
                    onClick={() => setShowClientSearchDropdown(true)}
                  />
                  {showClientSearchDropdown && filteredSearchClients.length > 0 && (
                    <ul className="absolute z-20 w-full mt-1 bg-white border-2 border-blue-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      <li
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer font-bold border-b text-gray-600 flex justify-between items-center text-sm"
                        onClick={() => { 
                          setClientSearchTerm(''); 
                          setSelectedSearchClientId(null); 
                          setShowClientSearchDropdown(false); 
                          setCurrentPage(1); 
                        }}
                      >
                        <span>전체 보기</span><span>↺</span>
                      </li>
                      {filteredSearchClients.map(c => (
                        <li
                          key={c.id}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer font-bold text-blue-900 border-b border-gray-100 text-sm"
                          onClick={() => {
                            setClientSearchTerm(c.name);
                            setSelectedSearchClientId(c.id!);
                            setShowClientSearchDropdown(false);
                            setCurrentPage(1);
                          }}
                        >
                          {c.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="h-px bg-gray-200 my-2"></div>
                <button onClick={downloadTemplate} className="w-full bg-green-50 text-green-700 border border-green-200 p-3 rounded-lg hover:bg-green-100 transition font-bold text-sm">
                  ⬇️ 엑셀 빈 양식 다운
                </button>
                <label className="w-full cursor-pointer bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition font-bold text-sm text-center shadow-md block">
                  ⬆️ 일괄 업로드 (엑셀)
                  <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          </div>

          {/* 오른쪽 패널: 리스트 뷰 및 페이징 */}
          <div className="w-full lg:w-3/4">
            <div className="bg-white p-4 md:p-6 shadow-lg rounded-lg min-h-[500px] flex flex-col">
              
              {loading ? (
                <div className="flex-grow flex items-center justify-center">
                  <p className="font-bold text-gray-500">데이터를 불러오는 중입니다...</p>
                </div>
              ) : displayClients.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 p-10">
                  <p className="text-gray-500 mb-2 font-bold">조건에 맞는 거래처가 없습니다.</p>
                  <p className="text-sm text-gray-400">검색어를 지우거나 신규 등록해주세요.</p>
                </div>
              ) : (
                <>
                  {/* 데스크탑 뷰 */}
                  <div className="hidden md:block overflow-x-auto flex-grow">
                    <table className="w-full border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-gray-100 text-left text-sm border-y-2 border-gray-300">
                          <th className="p-3 w-16 text-center">No</th>
                          <th className="p-3 w-64">상호(명)</th>
                          <th className="p-3 w-36">사업자번호</th>
                          <th className="p-3 w-28">대표자명</th>
                          <th className="p-3 text-center w-36">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentClients.map((client, idx) => {
                          const actualIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                          return (
                            <tr key={client.id} className="border-b hover:bg-blue-50 text-sm transition">
                              <td className="p-3 text-center text-gray-400 font-bold">{actualIndex}</td>
                              <td className="p-3 font-extrabold text-blue-900 text-base">{client.name}</td>
                              <td className="p-3 font-medium text-gray-700">{client.business_number || '-'}</td>
                              <td className="p-3 text-gray-700">{client.ceo_name || '-'}</td>
                              <td className="p-3 text-center space-x-1 whitespace-nowrap">
                                <button onClick={() => editClient(client)} className="text-blue-600 font-bold px-3 py-1.5 bg-white border border-blue-200 rounded hover:bg-blue-50 transition text-xs shadow-sm">상세/수정</button>
                                <button onClick={() => handleDeleteClient(client.id!, client.name)} className="text-red-500 font-bold px-2 py-1.5 bg-white border border-red-200 rounded hover:bg-red-50 transition text-xs">삭제</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 모바일 카드 뷰 */}
                  <div className="md:hidden space-y-4 flex-grow">
                    {currentClients.map((client, idx) => {
                      const actualIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                      return (
                        <div key={client.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-extrabold text-lg text-blue-900">{client.name}</h3>
                            <span className="text-xs font-bold text-gray-400">#{actualIndex}</span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1 mb-3">
                            <p><span className="font-bold w-20 inline-block text-gray-500">사업자:</span> {client.business_number || '-'}</p>
                            <p><span className="font-bold w-20 inline-block text-gray-500">대표자:</span> {client.ceo_name || '-'}</p>
                          </div>
                          <div className="flex gap-2 justify-end border-t border-dashed pt-3 mt-2">
                            <button onClick={() => editClient(client)} className="bg-blue-50 text-blue-700 border border-blue-200 px-5 py-2 rounded-lg text-sm font-bold">상세 정보 열기</button>
                            <button onClick={() => handleDeleteClient(client.id!, client.name)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold">삭제</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 페이징(페이지네이션) UI */}
                  {totalPages > 1 && (
                    <div className="mt-6 pt-4 flex justify-center items-center gap-2 border-t border-gray-200 shrink-0">
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1.5 rounded font-bold text-sm ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      >
                        이전
                      </button>
                      
                      <div className="flex gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`w-8 h-8 shrink-0 rounded font-bold text-sm flex items-center justify-center transition-colors ${
                              currentPage === i + 1 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>

                      <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1.5 rounded font-bold text-sm ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      >
                        다음
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}