"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 타입 지정 (빌드 에러 방지)
interface Client {
  id: string;
  name: string;
  business_number: string;
  contact: string;
  address: string;
  memo: string;
}

// 제이테크 거래처 관리 페이지 (모바일 반응형 완벽 지원)
export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 폼 상태 관리
  const [name, setName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');

  // 1. 거래처 목록 불러오기 (Read)
  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('거래처 불러오기 에러:', error.message);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // 2. 거래처 추가하기 (Create)
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('거래처 상호명은 필수입니다.');
      return;
    }

    try {
      // 에러 방지: DB에 등록된 첫 번째 회사(제이테크)의 ID를 무조건 가져와서 매핑합니다.
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .single();

      if (companyError || !companyData) throw new Error('등록된 본사(제이테크) 정보가 없습니다. SQL 세팅을 확인하세요.');

      const { error } = await supabase
        .from('clients')
        .insert([
          {
            company_id: companyData.id,
            name,
            business_number: businessNumber,
            contact,
            address,
            memo
          }
        ]);

      if (error) throw error;

      alert('거래처가 성공적으로 등록되었습니다.');
      // 폼 초기화
      setName('');
      setBusinessNumber('');
      setContact('');
      setAddress('');
      setMemo('');
      // 목록 새로고침
      fetchClients();

    } catch (error: any) {
      console.error('거래처 등록 에러:', error.message);
      alert(error.message || '거래처 등록에 실패했습니다.');
    }
  };

  // 3. 거래처 삭제하기 (Delete)
  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 이 거래처를 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      alert('삭제되었습니다.');
      fetchClients();
    } catch (error: any) {
      console.error('삭제 에러:', error.message);
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 왼쪽: 거래처 등록 폼 */}
        <div className="bg-white p-6 shadow-lg rounded-lg h-fit">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">신규 거래처 등록</h2>
          <form onSubmit={handleAddClient} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">상호명 (필수)</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500" placeholder="예: 영일전자" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">사업자번호</label>
              <input type="text" value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500" placeholder="000-00-00000" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">연락처</label>
              <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500" placeholder="담당자 연락처" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">주소</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500" placeholder="납품 주소" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">메모</label>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500 resize-none h-20" placeholder="특이사항" />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition">
              등록하기
            </button>
          </form>
        </div>

        {/* 오른쪽: 거래처 목록 리스트 */}
        <div className="md:col-span-2 bg-white p-6 shadow-lg rounded-lg">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">거래처 목록</h2>
          
          {loading ? (
            <p className="text-center text-gray-500 py-10">데이터를 불러오는 중입니다...</p>
          ) : clients.length === 0 ? (
            <p className="text-center text-gray-500 py-10">등록된 거래처가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm">
                    <th className="p-3 border">상호명</th>
                    <th className="p-3 border">연락처</th>
                    <th className="p-3 border">주소</th>
                    <th className="p-3 border text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b hover:bg-gray-50 text-sm">
                      <td className="p-3 font-medium">{client.name}</td>
                      <td className="p-3">{client.contact || '-'}</td>
                      <td className="p-3 text-gray-600 truncate max-w-[200px]">{client.address || '-'}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDelete(client.id)} className="text-red-500 hover:text-red-700 font-bold px-2 py-1 border border-red-200 rounded">
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
  );
}