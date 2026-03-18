"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function CompanySettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState('');

  const [name, setName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [ceoName, setCeoName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  // === 신규: 계좌번호 상태 추가 ===
  const [bankAccount, setBankAccount] = useState('');

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        if (!profile) throw new Error('프로필 정보가 없습니다.');
        setCompanyId(profile.company_id);

        const { data: companyData, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single();

        if (error) throw error;

        if (companyData) {
          setName(companyData.name || '');
          setBusinessNumber(companyData.business_number || '');
          setCeoName(companyData.ceo_name || '');
          setAddress(companyData.address || '');
          setContact(companyData.contact || '');
          // DB에서 계좌번호 불러오기
          setBankAccount(companyData.bank_account || '');
        }
      } catch (error: any) {
        console.error('회사 정보 로드 실패:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyInfo();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('상호명은 필수입니다.');
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('companies')
        .update({
          name,
          business_number: businessNumber,
          ceo_name: ceoName,
          address,
          contact,
          bank_account: bankAccount // 계좌번호 저장
        })
        .eq('id', companyId);

      if (error) throw error;
      alert('회사 정보가 성공적으로 저장되었습니다.\n(입력하신 계좌번호는 거래처 보관용 명세서에 자동 출력됩니다.)');
      router.push('/'); 
    } catch (error: any) {
      alert('저장에 실패했습니다: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500 font-bold">회사 정보를 불러오는 중입니다...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black flex items-center justify-center">
      <div className="max-w-xl w-full bg-white p-6 md:p-8 shadow-xl rounded-2xl border border-gray-100">
        
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center">
            <span className="mr-2">⚙️</span> 내 회사 정보 설정
          </h1>
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-600 font-bold px-3 py-1 bg-gray-100 rounded-lg transition">
            ✕ 닫기
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-sm text-blue-800 font-medium">
          💡 여기에 등록한 정보는 거래명세표 출력 시 <strong>'공급자'</strong> 란에 자동으로 인쇄됩니다.
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">상호 (회사명) <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-blue-500 bg-white transition" placeholder="예: J-TECH (제이테크)" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">사업자등록번호</label>
            <input type="text" value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-blue-500 bg-white transition" placeholder="예: 123-45-67890" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">대표자 성명</label>
            <input type="text" value={ceoName} onChange={(e) => setCeoName(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-blue-500 bg-white transition" placeholder="예: 홍길동" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">사업장 주소</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-blue-500 bg-white transition" placeholder="예: 경기도 시흥시 목감동..." />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">대표 연락처</label>
            <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-blue-500 bg-white transition" placeholder="예: 010-1234-5678 또는 031-123-4567" />
          </div>
          
          {/* === 신규: 결제 계좌번호 입력 칸 === */}
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mt-2">
            <label className="block text-sm font-bold text-yellow-800 mb-1">입금 계좌번호 (선택)</label>
            <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="w-full border-2 border-yellow-300 rounded-lg p-3 outline-none focus:border-yellow-500 bg-white transition" placeholder="예: 기업은행 123-4567-8901 (제이테크)" />
            <p className="text-xs text-gray-500 mt-2">* 입력 시 거래처 전달용 명세서(하단)에만 계좌번호가 자동 인쇄됩니다.</p>
          </div>
          
          <div className="pt-4 mt-6 border-t border-gray-100">
            <button type="submit" disabled={isSaving} className={`w-full text-white font-extrabold text-lg py-4 rounded-xl shadow-lg transition ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1'}`}>
              {isSaving ? '저장 중...' : '회사 정보 업데이트'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}