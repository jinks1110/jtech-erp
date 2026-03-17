"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // 신규: 페이지 이동을 위한 라우터
import { supabase } from '@/lib/supabase';

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_path: string;
  created_at: string;
}

export default function MainPage() {
  const router = useRouter(); // 라우터 초기화
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // 공용 첨부파일 불러오기
  const fetchAttachments = async () => {
    try {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // 세션이 없으면 로그인 페이지로 강제 이동 (보안 강화)
      if (sessionError || !session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile) return;

      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('company_id', profile.company_id)
        .is('invoice_id', null) 
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("파일 불러오기 에러:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, []);

  // 공용 파일 업로드
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
      
      fetchAttachments();
      alert('공용 문서가 성공적으로 등록되었습니다.');

    } catch (error: any) {
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // 공용 파일 삭제
  const handleDeleteFile = async (id: string, filePath: string) => {
    if (!window.confirm('이 공용 문서를 삭제하시겠습니까?')) return;
    try {
      await supabase.storage.from('attachments').remove([filePath]);
      const { error } = await supabase.from('attachments').delete().eq('id', id);
      if (error) throw error;
      fetchAttachments();
    } catch (error) {
      alert('삭제에 실패했습니다.');
    }
  };

  // === 신규 추가: 철통 보안 로그아웃 기능 ===
  const handleLogout = async () => {
    if (!window.confirm('ERP 시스템에서 로그아웃 하시겠습니까?')) return;
    
    try {
      // 1. Supabase 서버에 세션 파기 요청 및 로컬 금고(Token) 삭제
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // 2. 로그인 페이지로 즉시 튕겨냄
      router.push('/login');
    } catch (error: any) {
      alert('로그아웃 처리 중 문제가 발생했습니다.');
      console.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        
        {/* 상단 환영 헤더 & 로그아웃 버튼 */}
        <header className="bg-white p-4 md:p-6 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-start md:items-center border-l-4 border-blue-600 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">J-TECH 통합 ERP 시스템</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1 font-medium">환영합니다! 원하시는 업무를 선택해주세요.</p>
          </div>
          
          {/* 로그아웃 버튼 (모바일에서는 화면 꽉 차게, PC에서는 우측에 예쁘게) */}
          <button 
            onClick={handleLogout}
            className="w-full md:w-auto bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 font-bold py-2 md:py-3 px-6 rounded-lg border border-gray-300 hover:border-red-300 transition shadow-sm flex items-center justify-center gap-2"
          >
            <span>🔒</span> 로그아웃
          </button>
        </header>

        {/* 4대 핵심 메뉴 바로가기 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Link href="/clients" className="bg-white p-6 rounded-lg shadow hover:shadow-xl transition transform hover:-translate-y-1 group border border-transparent hover:border-gray-200">
            <div className="text-4xl mb-4 group-hover:scale-110 transition inline-block">🏢</div>
            <h2 className="text-xl font-bold text-gray-800">거래처 관리</h2>
            <p className="text-sm text-gray-500 mt-2">신규 거래처 등록 및 비활성화 관리</p>
          </Link>
          <Link href="/products" className="bg-white p-6 rounded-lg shadow hover:shadow-xl transition transform hover:-translate-y-1 group border border-transparent hover:border-gray-200">
            <div className="text-4xl mb-4 group-hover:scale-110 transition inline-block">📦</div>
            <h2 className="text-xl font-bold text-gray-800">품목 단가 관리</h2>
            <p className="text-sm text-gray-500 mt-2">하네스 규격 및 단가표 업데이트</p>
          </Link>
          <Link href="/invoice" className="bg-white p-6 rounded-lg shadow hover:shadow-xl transition transform hover:-translate-y-1 group border-2 border-transparent hover:border-blue-400">
            <div className="text-4xl mb-4 group-hover:scale-110 transition inline-block">✍️</div>
            <h2 className="text-xl font-bold text-blue-700">명세서 작성</h2>
            <p className="text-sm text-gray-500 mt-2">신규 거래명세표 입력 및 발행</p>
          </Link>
          <Link href="/sales" className="bg-white p-6 rounded-lg shadow hover:shadow-xl transition transform hover:-translate-y-1 group border border-transparent hover:border-gray-200">
            <div className="text-4xl mb-4 group-hover:scale-110 transition inline-block">📊</div>
            <h2 className="text-xl font-bold text-gray-800">매출 및 내역 조회</h2>
            <p className="text-sm text-gray-500 mt-2">과거 명세서 조회 및 엑셀 다운로드</p>
          </Link>
        </div>

        {/* 공용 자료실 (첨부파일) */}
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center">
                <span className="mr-2">📁</span> J-TECH 공용 자료실
              </h2>
              <p className="text-sm text-gray-500 mt-1">사업자등록증, 통장사본, 제품 카탈로그 등 자주 쓰는 문서를 보관하세요.</p>
            </div>
            <label className={`w-full md:w-auto text-center cursor-pointer whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 font-bold py-3 px-6 rounded shadow transition ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isUploading ? '업로드 중...' : '+ 새 문서 등록'}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>

          {loading ? (
            <p className="text-center text-gray-500 py-10">파일을 불러오는 중입니다...</p>
          ) : attachments.length === 0 ? (
            <div className="text-center bg-gray-50 rounded-lg py-12 border-2 border-dashed border-gray-300">
              <span className="text-5xl mb-3 block text-gray-400">📭</span>
              <p className="text-gray-500 font-medium text-lg">등록된 공용 문서가 없습니다.</p>
              <p className="text-gray-400 text-sm mt-1">우측 상단의 '+ 새 문서 등록' 버튼을 눌러 파일을 추가해보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attachments.map((file) => (
                <div key={file.id} className="bg-gray-50 border border-gray-200 rounded-lg p-5 flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition group">
                  <div className="flex items-start mb-4">
                    <span className="text-3xl mr-3">📄</span>
                    <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="font-bold text-gray-800 group-hover:text-blue-600 transition break-all line-clamp-2 leading-tight">
                      {file.file_name}
                    </a>
                  </div>
                  <div className="flex justify-between items-center mt-auto border-t pt-3">
                    <span className="text-xs font-medium text-gray-400">{new Date(file.created_at).toLocaleDateString()}</span>
                    <button onClick={() => handleDeleteFile(file.id, file.file_path)} className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-100 bg-red-50 px-3 py-1.5 rounded transition">
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}