"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Client {
  id: string;
  name: string;
  business_number: string;
  address: string;
  contact: string;
  is_active: boolean;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile) throw new Error('소속된 회사 정보가 없습니다.');

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('불러오기 에러:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('상호명은 필수 입력 사항입니다.');
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('clients').update({ name, business_number: businessNumber, address, contact }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('로그인 만료');

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        if (!profile) throw new Error('회사 정보 없음');

        const { error } = await supabase.from('clients').insert([{ 
          company_id: profile.company_id,
          name, 
          business_number: businessNumber, 
          address, 
          contact, 
          is_active: true 
        }]);
        if (error) throw error;
      }

      resetForm();
      fetchClients();
    } catch (error: any) {
      alert('저장에 실패했습니다. ' + error.message);
    }
  };

  const handleEditClick = (client: Client) => {
    setEditingId(client.id);
    setName(client.name);
    setBusinessNumber(client.business_number || '');
    setAddress(client.address || '');
    setContact(client.contact || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setBusinessNumber('');
    setAddress('');
    setContact('');
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const actionText = currentStatus ? '비활성화' : '다시 활성화';
    if (!window.confirm(`이 거래처를 ${actionText} 하시겠습니까?`)) return;

    try {
      const { error } = await supabase.from('clients').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      fetchClients();
    } catch (error: any) {
      alert('상태 변경에 실패했습니다.');
    }
  };

  // === 신규 추가: 영구 삭제 로직 (안전장치 포함) ===
  const handleDeleteClient = async (id: string) => {
    if (!window.confirm('이 거래처를 완전히 삭제하시겠습니까?\n(오타나 테스트 등록 건만 삭제를 권장합니다.)')) return;

    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      
      if (error) {
        // 23503 코드는 DB 외래키 제약조건 위반 (이미 다른 명세서에서 쓰고 있음)
        if (error.code === '23503') {
          alert('이 거래처로 발행된 명세서 내역이 존재하여 삭제할 수 없습니다.\n과거 데이터 보호를 위해 [비활성화] 기능을 사용해주세요.');
          return;
        }
        throw error;
      }
      
      alert('거래처가 성공적으로 삭제되었습니다.');
      fetchClients();
    } catch (error: any) {
      console.error('삭제 에러:', error.message);
      alert('삭제에 실패했습니다.');
    }
  };

  const filteredClients = clients.filter(client => showInactive ? true : client.is_active);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* 폼 영역 */}
        <div className={`p-4 md:p-6 shadow-lg rounded-lg h-fit transition-colors lg:col-span-1 ${editingId ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-white'}`}>
          <h2 className={`text-lg md:text-xl font-bold mb-4 border-b pb-2 ${editingId ? 'text-yellow-700' : ''}`}>
            {editingId ? '거래처 정보 수정' : '신규 거래처 등록'}
          </h2>
          <form onSubmit={handleSaveClient} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">상호명 (필수)</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded p-3 outline-none focus:border-blue-500 bg-white" placeholder="예: 영일전자" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">사업자등록번호</label>
              <input type="text" value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} className="w-full border rounded p-3 outline-none focus:border-blue-500 bg-white" placeholder="예: 123-45-67890" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">연락처</label>
              <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} className="w-full border rounded p-3 outline-none focus:border-blue-500 bg-white" placeholder="예: 010-1234-5678" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">주소</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border rounded p-3 outline-none focus:border-blue-500 bg-white" placeholder="예: 경기도 시흥시..." />
            </div>
            
            <div className="pt-2 flex flex-col gap-2">
              <button type="submit" className={`w-full text-white font-bold py-3 rounded-lg transition shadow ${editingId ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {editingId ? '수정 내용 저장' : '거래처 등록'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="w-full bg-gray-400 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition shadow">
                  수정 취소
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 리스트 영역 */}
        <div className="lg:col-span-3 bg-white p-4 md:p-6 shadow-lg rounded-lg">
          <div className="flex justify-between items-end mb-4 border-b pb-2">
            <h2 className="text-lg md:text-xl font-bold">거래처 목록 ({filteredClients.length}건)</h2>
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={showInactive} onChange={() => setShowInactive(!showInactive)} />
                <div className={`block w-10 h-6 rounded-full transition ${showInactive ? 'bg-gray-400' : 'bg-blue-500'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${showInactive ? 'transform translate-x-4' : ''}`}></div>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">비활성 포함</span>
            </label>
          </div>
          
          {loading ? (
            <p className="text-center text-gray-500 py-10">데이터를 불러오는 중입니다...</p>
          ) : filteredClients.length === 0 ? (
            <p className="text-center text-gray-500 py-10">등록된 거래처가 없습니다.</p>
          ) : (
            <>
              {/* 1. 데스크탑 뷰 (표 형식) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-100 text-left text-sm">
                      <th className="p-3 border text-center whitespace-nowrap">상태</th>
                      <th className="p-3 border whitespace-nowrap">상호명</th>
                      <th className="p-3 border whitespace-nowrap">사업자번호</th>
                      <th className="p-3 border whitespace-nowrap">연락처</th>
                      <th className="p-3 border text-center whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr key={client.id} className={`border-b hover:bg-gray-50 text-sm ${!client.is_active ? 'bg-gray-100 text-gray-400' : ''}`}>
                        <td className="p-3 text-center whitespace-nowrap">
                          {client.is_active ? (
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">사용중</span>
                          ) : (
                            <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded">비활성</span>
                          )}
                        </td>
                        <td className={`p-3 font-bold ${!client.is_active ? 'line-through decoration-gray-400' : ''}`}>{client.name}</td>
                        <td className="p-3">{client.business_number || '-'}</td>
                        <td className="p-3">{client.contact || '-'}</td>
                        <td className="p-3 text-center space-x-1 whitespace-nowrap">
                          <button onClick={() => handleEditClick(client)} className="text-blue-600 hover:text-blue-800 font-bold px-2 py-1 border border-blue-200 rounded bg-white">
                            수정
                          </button>
                          <button onClick={() => handleToggleActive(client.id, client.is_active)} className={`${client.is_active ? 'text-yellow-600 hover:text-yellow-800 border-yellow-200' : 'text-green-600 hover:text-green-800 border-green-200'} font-bold px-2 py-1 border rounded bg-white`}>
                            {client.is_active ? '비활성' : '활성'}
                          </button>
                          {/* 신규: 데스크탑 삭제 버튼 */}
                          <button onClick={() => handleDeleteClient(client.id)} className="text-gray-500 hover:text-red-600 hover:bg-red-50 font-bold px-2 py-1 border border-gray-200 rounded bg-white transition">
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 2. 모바일 뷰 (카드 형식) */}
              <div className="md:hidden space-y-3">
                {filteredClients.map((client) => (
                  <div key={client.id} className={`p-4 border-2 rounded-xl shadow-sm bg-white ${!client.is_active ? 'border-gray-200 opacity-70' : 'border-gray-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="mb-1">
                          {client.is_active ? (
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">사용중</span>
                          ) : (
                            <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded">비활성</span>
                          )}
                        </div>
                        <h3 className={`text-lg font-bold ${!client.is_active ? 'line-through text-gray-500' : 'text-gray-900'}`}>{client.name}</h3>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1 mb-4">
                      <p><span className="font-medium">사업자:</span> {client.business_number || '없음'}</p>
                      <p><span className="font-medium">연락처:</span> {client.contact || '없음'}</p>
                      <p className="truncate"><span className="font-medium">주소:</span> {client.address || '없음'}</p>
                    </div>
                    <div className="flex gap-2 border-t pt-3">
                      <button onClick={() => handleEditClick(client)} className="flex-1 text-blue-600 bg-blue-50 font-bold py-2 rounded-lg border border-blue-100 text-sm">
                        수정
                      </button>
                      <button onClick={() => handleToggleActive(client.id, client.is_active)} className={`flex-1 font-bold py-2 rounded-lg border text-sm ${client.is_active ? 'text-yellow-600 bg-yellow-50 border-yellow-100' : 'text-green-600 bg-green-50 border-green-100'}`}>
                        {client.is_active ? '비활성화' : '활성화'}
                      </button>
                      {/* 신규: 모바일 삭제 버튼 */}
                      <button onClick={() => handleDeleteClient(client.id)} className="flex-1 text-gray-500 bg-gray-50 font-bold py-2 rounded-lg border border-gray-200 hover:bg-red-50 hover:text-red-500 transition text-sm">
                        삭제
                      </button>
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