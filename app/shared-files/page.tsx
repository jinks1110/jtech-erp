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
}

export default function SharedFilesPage() {
  const router = useRouter();
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // === 신규 추가: 파일 검색 상태 ===
  const [searchTerm, setSearchTerm] = useState('');

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
        file_url: urlData.publicUrl
      }]);

      if (dbError) throw dbError;
      
      fetchSharedFiles();
      alert('공용 문서가 성공적으로 등록되었습니다.');

    } catch (error: any) {
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteFile = async (id: string, filePath: string) => {
    if (!window.confirm('이 공용 문서를 삭제하시겠습니까?')) return;
    try {
      await supabase.storage.from('attachments').remove([filePath]);
      const { error } = await supabase.from('attachments').delete().eq('id', id);
      if (error) throw error;
      fetchSharedFiles();
    } catch (error) {
      alert('삭제에 실패했습니다.');
    }
  };

  // === 파일 검색 필터 로직 ===
  const filteredAttachments = attachments.filter(file => 
    file.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black relative">
      
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in-up { animation: fadeInUp 0.2s ease-out forwards; }
        `
      }} />

      {/* === 레이아웃 확장 및 좌우 분할 구조 적용 === */}
      <div className="max-w-[95%] xl:max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* === 좌측 패널: 컨트롤 박스 === */}
        <div className="w-full lg:w-1/4 space-y-4 shrink-0">
          <div className="bg-white p-5 md:p-6 shadow-lg rounded-lg border-t-4 border-blue-600 sticky top-6">
            <div className="mb-4 border-b pb-4">
              <h1 className="text-xl md:text-2xl font-extrabold">공용 자료실</h1>
              <p className="text-gray-500 text-sm mt-1 font-bold">사내 공용 문서 보관 및 관리</p>
            </div>
            
            <div className="space-y-4">
              {/* 업로드 버튼 */}
              <label className={`w-full block text-center cursor-pointer whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 font-bold py-3 px-6 rounded-lg shadow-md transition ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span>{isUploading ? '업로드 중...' : '+ 새 공용 문서 등록'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
              </label>

              <div className="h-px bg-gray-200 my-4"></div>

              {/* 검색창 */}
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
                <p className="text-xs text-blue-800 font-bold leading-relaxed">
                  * 사업자등록증, 통장사본, 제품 카탈로그 등 전 직원이 자주 사용하는 문서를 이곳에 보관하세요.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* === 우측 패널: 데이터 뷰 (리스트 형태) === */}
        <div className="w-full lg:w-3/4 flex flex-col gap-6 overflow-hidden">
          
          <div className="bg-white p-4 md:p-6 shadow-lg rounded-xl flex-grow min-h-[500px]">
            <div className="mb-4 flex justify-between items-end">
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
                      <th className="p-3 w-16 text-center font-bold text-gray-700">No</th>
                      <th className="p-3 font-extrabold text-blue-700">파일명</th>
                      <th className="p-3 w-40 text-center font-bold text-gray-700">등록일자</th>
                      <th className="p-3 w-32 text-center font-bold text-gray-700">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttachments.map((file, idx) => (
                      <tr key={file.id} className="border-b hover:bg-blue-50 transition text-sm">
                        <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-extrabold text-gray-900 truncate max-w-[300px] lg:max-w-[500px]" title={file.file_name}>
                          <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition flex items-center gap-2">
                            <span className="text-lg">📄</span> {file.file_name}
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
                            className="inline-block text-blue-600 font-bold px-3 py-1.5 bg-white border border-blue-200 rounded hover:bg-blue-50 text-xs shadow-sm"
                          >
                            열기
                          </a>
                          <button 
                            onClick={() => handleDeleteFile(file.id, file.file_path)} 
                            className="inline-block text-red-500 font-bold px-3 py-1.5 bg-white border border-red-200 rounded hover:bg-red-50 text-xs shadow-sm"
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