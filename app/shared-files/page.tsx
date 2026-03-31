"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_path: string;
  created_at: string;
  is_important?: boolean;
}

export default function SharedFilesPage() {
  const router = useRouter();
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', desc: '', confirmColor: 'bg-blue-600 hover:bg-blue-700', onConfirm: () => {} });
  
  const closeAlert = () => setAlertModal(prev => ({ ...prev, isOpen: false }));
  
  const showAlert = (title: string, desc: string, confirmColor = 'bg-blue-600 hover:bg-blue-700') => {
    setAlertModal({ isOpen: true, title, desc, confirmColor, onConfirm: closeAlert });
  };

  const fetchSharedFiles = async () => {
    try {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile) return;

      const { data: attachData, error: attachError } = await supabase
        .from('attachments')
        .select('*')
        .eq('company_id', profile.company_id)
        .is('invoice_id', null) 
        .order('created_at', { ascending: false });

      if (!attachError && attachData) {
        setAttachments(attachData);
      }

    } catch (error) {
      console.error("데이터 불러오기 에러:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setIsUploading(true);

      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session!.user.id).single();

      const fileExt = file.name.split('.').pop();
      const fileName = `global_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('attachments').insert([{
        company_id: profile!.company_id,
        file_name: file.name,
        file_path: filePath,
        file_url: urlData.publicUrl,
        is_important: false
      }]);

      if (dbError) throw dbError;
      
      fetchSharedFiles();
      showAlert('등록 완료', '공용 문서가 성공적으로 등록되었습니다.', 'bg-green-600 hover:bg-green-700');

    } catch (error: any) {
      showAlert('업로드 실패', '파일 업로드에 실패했습니다.', 'bg-red-600 hover:bg-red-700');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const toggleImportant = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('attachments').update({ is_important: !currentStatus }).eq('id', id);
      if (error) throw error;
      
      fetchSharedFiles();
    } catch (error) {
      showAlert('오류', '중요 상태 변경에 실패했습니다.', 'bg-red-600 hover:bg-red-700');
    }
  };

  const handleDeleteFile = async (id: string, filePath: string, isImportant: boolean) => {
    if (isImportant) {
      return showAlert('삭제 불가', '중요(⭐) 표시된 파일은 삭제할 수 없습니다.\n삭제를 원하시면 먼저 별표를 해제해주세요.', 'bg-yellow-500 hover:bg-yellow-600');
    }

    if (!window.confirm('이 공용 문서를 삭제하시겠습니까?')) return;
    try {
      await supabase.storage.from('attachments').remove([filePath]);
      const { error } = await supabase.from('attachments').delete().eq('id', id);
      if (error) throw error;
      fetchSharedFiles();
    } catch (error) {
      showAlert('삭제 실패', '파일 삭제에 실패했습니다.', 'bg-red-600 hover:bg-red-700');
    }
  };

  const filteredAttachments = attachments
    .filter(file => file.file_name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (a.is_important && !b.is_important) return -1;
      if (!a.is_important && b.is_important) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); 
    });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black relative">
      
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4">
          <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-[2px]" onClick={closeAlert}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm animate-fade-in-up z-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">{alertModal.title}</h3>
            <p className="text-gray-600 mb-6 whitespace-pre-line text-sm font-medium leading-relaxed">{alertModal.desc}</p>
            <div className="flex justify-end">
              <button onClick={alertModal.onConfirm} className={`px-5 py-2 rounded-lg font-bold text-white cursor-pointer transition shadow-md ${alertModal.confirmColor}`}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }
        `
      }} />

      <div className="max-w-[95%] xl:max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">
        
        <div className="w-full lg:w-1/4 space-y-4 shrink-0">
          <div className="bg-white p-5 md:p-6 shadow-lg rounded-lg border-t-4 border-blue-600 lg:sticky lg:top-6">
            <div className="mb-4 border-b pb-4">
              <h1 className="text-xl md:text-2xl font-extrabold">공용 자료실</h1>
              <p className="text-gray-500 text-sm mt-1 font-bold">사내 공용 문서 보관 및 관리</p>
            </div>
            
            <div className="space-y-4">
              <label className={`w-full block text-center cursor-pointer whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 font-bold py-3 px-6 rounded-lg shadow-md transition ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span>{isUploading ? '업로드 중...' : '+ 새 공용 문서 등록'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
              </label>

              <div className="h-px bg-gray-200 my-4"></div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">문서 검색</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 font-bold">🔍</span>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-200 rounded-lg outline-none focus:border-blue-600 bg-white font-bold placeholder-gray-400"
                    placeholder="파일명 입력..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mt-4">
                <p className="text-xs text-blue-800 font-bold leading-relaxed mb-2">
                  * 사업자등록증, 통장사본, 제품 카탈로그 등 전 직원이 자주 사용하는 문서를 보관하세요.
                </p>
                <p className="text-xs text-yellow-700 font-extrabold leading-relaxed bg-yellow-50 p-2 rounded border border-yellow-200">
                  ⭐ 중요 표시된 문서는 최상단에 고정되며 삭제가 불가능해집니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-3/4 flex flex-col gap-6 overflow-hidden">
          
          <div className="bg-white p-4 md:p-6 shadow-lg rounded-xl flex-grow min-h-[500px]">
            <div className="mb-4 flex justify-between items-end border-b border-dashed pb-3">
              <h2 className="text-lg font-extrabold text-gray-800">문서 목록 <span className="text-blue-600 text-sm ml-1">총 {filteredAttachments.length}건</span></h2>
            </div>

            {loading ? (
              <div className="h-full flex items-center justify-center min-h-[300px]"><p className="font-bold text-gray-500">데이터를 불러오는 중입니다...</p></div>
            ) : filteredAttachments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-10 min-h-[300px]">
                <span className="text-5xl mb-4 opacity-50">📭</span>
                <p className="text-gray-500 font-bold text-lg">{searchTerm ? '검색된 문서가 없습니다.' : '등록된 공용 문서가 없습니다.'}</p>
                {!searchTerm && <p className="text-gray-400 text-sm mt-1">좌측의 '+ 새 문서 등록' 버튼을 눌러 파일을 추가해보세요.</p>}
              </div>
            ) : (
              <div className="overflow-x-auto animate-fade-in-up">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-100 text-left text-sm border-b-2 border-gray-300">
                      <th className="p-3 w-16 text-center font-bold text-gray-700">중요</th>
                      <th className="p-3 font-extrabold text-blue-700">파일명</th>
                      <th className="p-3 w-40 text-center font-bold text-gray-700">등록일자</th>
                      <th className="p-3 w-32 text-center font-bold text-gray-700">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttachments.map((file) => (
                      <tr key={file.id} className={`border-b transition text-sm ${file.is_important ? 'bg-yellow-50/30 hover:bg-yellow-50' : 'hover:bg-blue-50'}`}>
                        <td className="p-3 text-center align-middle">
                          {/* === 수정 포인트: cursor-pointer 추가로 마우스 손가락 모양 활성화 === */}
                          <button 
                            onClick={() => toggleImportant(file.id, file.is_important || false)}
                            className={`cursor-pointer text-2xl transition-transform hover:scale-125 ${file.is_important ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}`}
                            title={file.is_important ? "중요 해제" : "중요 설정 (상단 고정 및 삭제 방지)"}
                          >
                            {file.is_important ? '⭐' : '☆'}
                          </button>
                        </td>
                        
                        <td className="p-3 font-extrabold text-gray-900 truncate max-w-[300px] lg:max-w-[500px]" title={file.file_name}>
                          <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:text-blue-600 transition flex items-center gap-2">
                            <span className="text-lg">📄</span> 
                            {file.file_name}
                            {file.is_important && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 border border-yellow-300 px-1.5 py-0.5 rounded font-extrabold">중요</span>}
                          </a>
                        </td>
                        
                        <td className="p-3 text-center font-bold text-gray-500">
                          {new Date(file.created_at).toLocaleDateString()}
                        </td>
                        
                        <td className="p-3 text-center space-x-2 whitespace-nowrap">
                          <a 
                            href={file.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="cursor-pointer inline-block text-blue-600 font-bold px-3 py-1.5 bg-white border border-blue-200 rounded hover:bg-blue-50 text-xs shadow-sm"
                          >
                            열기
                          </a>
                          <button 
                            onClick={() => handleDeleteFile(file.id, file.file_path, file.is_important || false)} 
                            className={`inline-block font-bold px-3 py-1.5 bg-white border rounded text-xs shadow-sm transition ${file.is_important ? 'text-gray-400 border-gray-200 hover:bg-gray-100 cursor-not-allowed' : 'cursor-pointer text-red-500 border-red-200 hover:bg-red-50'}`}
                            title={file.is_important ? "중요 파일은 삭제할 수 없습니다." : "파일 삭제"}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}