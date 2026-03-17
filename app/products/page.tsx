"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  spec: string;
  price: number;
  is_vat_included: boolean;
  is_active: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [spec, setSpec] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [isVatIncluded, setIsVatIncluded] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile) throw new Error('소속된 회사 정보가 없습니다.');

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('불러오기 에러:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price === '') {
      alert('품목명과 단가는 필수 입력 사항입니다.');
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase.from('products').update({ name, spec, price: Number(price), is_vat_included: isVatIncluded }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('로그인 만료');

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        if (!profile) throw new Error('회사 정보 없음');

        const { error } = await supabase.from('products').insert([{ 
          company_id: profile.company_id,
          name, 
          spec, 
          price: Number(price), 
          is_vat_included: isVatIncluded, 
          is_active: true 
        }]);
        if (error) throw error;
      }

      resetForm();
      fetchProducts();
    } catch (error: any) {
      alert('품목 저장에 실패했습니다. ' + error.message);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setSpec(product.spec || '');
    setPrice(product.price);
    setIsVatIncluded(product.is_vat_included);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSpec('');
    setPrice('');
    setIsVatIncluded(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const actionText = currentStatus ? '비활성화' : '다시 활성화';
    if (!window.confirm(`이 품목을 ${actionText} 하시겠습니까?`)) return;

    try {
      const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      fetchProducts();
    } catch (error: any) {
      alert('상태 변경에 실패했습니다.');
    }
  };

  // === 신규 추가: 영구 삭제 로직 (안전장치 포함) ===
  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('이 품목을 완전히 삭제하시겠습니까?\n(오타나 테스트 등록 건만 삭제를 권장합니다.)')) return;

    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      
      if (error) {
        if (error.code === '23503') {
          alert('이 품목이 포함된 명세서 내역이 존재하여 삭제할 수 없습니다.\n과거 데이터 보호를 위해 [비활성] 기능을 사용해주세요.');
          return;
        }
        throw error;
      }
      
      alert('품목이 성공적으로 삭제되었습니다.');
      fetchProducts();
    } catch (error: any) {
      console.error('삭제 에러:', error.message);
      alert('삭제에 실패했습니다.');
    }
  };

  const filteredProducts = products.filter(product => showInactive ? true : product.is_active);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* 폼 영역 */}
        <div className={`p-4 md:p-6 shadow-lg rounded-lg h-fit transition-colors lg:col-span-1 ${editingId ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-white'}`}>
          <h2 className={`text-lg md:text-xl font-bold mb-4 border-b pb-2 ${editingId ? 'text-yellow-700' : ''}`}>
            {editingId ? '품목 정보 수정' : '신규 품목 등록'}
          </h2>
          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">품목명 (필수)</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded p-3 outline-none focus:border-blue-500 bg-white" placeholder="예: 와이어 하네스 A형" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">규격</label>
              <input type="text" value={spec} onChange={(e) => setSpec(e.target.value)} className="w-full border rounded p-3 outline-none focus:border-blue-500 bg-white" placeholder="예: 200mm, AWG24" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">단가 (필수)</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border rounded p-3 outline-none focus:border-blue-500 text-right bg-white" placeholder="0" required />
            </div>
            <div className="flex items-center mt-2 bg-gray-50 p-3 rounded border">
              <input type="checkbox" id="vat" checked={isVatIncluded} onChange={(e) => setIsVatIncluded(e.target.checked)} className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500" />
              <label htmlFor="vat" className="ml-2 text-sm font-bold text-gray-900">부가세 포함 단가</label>
            </div>
            
            <div className="pt-2 flex flex-col gap-2">
              <button type="submit" className={`w-full text-white font-bold py-3 rounded-lg transition shadow ${editingId ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'}`}>
                {editingId ? '수정 내용 저장' : '품목 등록'}
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
            <h2 className="text-lg md:text-xl font-bold">품목 단가표 ({filteredProducts.length}건)</h2>
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
          ) : filteredProducts.length === 0 ? (
            <p className="text-center text-gray-500 py-10">등록된 품목이 없습니다.</p>
          ) : (
            <>
              {/* 1. 데스크탑 뷰 (표 형식) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-100 text-left text-sm">
                      <th className="p-3 border text-center whitespace-nowrap">상태</th>
                      <th className="p-3 border min-w-[200px]">품목명</th>
                      <th className="p-3 border">규격</th>
                      <th className="p-3 border text-right whitespace-nowrap">단가</th>
                      <th className="p-3 border text-center whitespace-nowrap">부가세</th>
                      <th className="p-3 border text-center whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className={`border-b hover:bg-gray-50 text-sm ${!product.is_active ? 'bg-gray-100 text-gray-400' : ''}`}>
                        <td className="p-3 text-center whitespace-nowrap">
                          {product.is_active ? (
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">사용중</span>
                          ) : (
                            <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded">비활성</span>
                          )}
                        </td>
                        <td className={`p-3 font-medium ${!product.is_active ? 'line-through decoration-gray-400' : ''}`}>{product.name}</td>
                        <td className="p-3">{product.spec || '-'}</td>
                        <td className="p-3 text-right font-medium whitespace-nowrap">{product.price.toLocaleString()}원</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {product.is_vat_included ? (
                            <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${product.is_active ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500'}`}>포함</span>
                          ) : (
                            <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${product.is_active ? 'bg-gray-100 text-gray-800' : 'bg-gray-200 text-gray-500'}`}>별도</span>
                          )}
                        </td>
                        <td className="p-3 text-center space-x-1 whitespace-nowrap">
                          <button onClick={() => handleEditClick(product)} className="text-blue-600 hover:text-blue-800 font-bold px-2 py-1 border border-blue-200 rounded bg-white">
                            수정
                          </button>
                          <button onClick={() => handleToggleActive(product.id, product.is_active)} className={`${product.is_active ? 'text-yellow-600 hover:text-yellow-800 border-yellow-200' : 'text-green-600 hover:text-green-800 border-green-200'} font-bold px-2 py-1 border rounded bg-white`}>
                            {product.is_active ? '비활성' : '활성'}
                          </button>
                          {/* 신규: 데스크탑 삭제 버튼 */}
                          <button onClick={() => handleDeleteProduct(product.id)} className="text-gray-500 hover:text-red-600 hover:bg-red-50 font-bold px-2 py-1 border border-gray-200 rounded bg-white transition">
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
                {filteredProducts.map((product) => (
                  <div key={product.id} className={`p-4 border-2 rounded-xl shadow-sm bg-white ${!product.is_active ? 'border-gray-200 opacity-70' : 'border-gray-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 pr-2">
                        <div className="flex gap-2 mb-1">
                          {product.is_active ? (
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">사용중</span>
                          ) : (
                            <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded">비활성</span>
                          )}
                          {product.is_vat_included ? (
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">VAT포함</span>
                          ) : (
                            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded border">VAT별도</span>
                          )}
                        </div>
                        <h3 className={`text-lg font-bold leading-tight mt-1 ${!product.is_active ? 'line-through text-gray-500' : 'text-gray-900'}`}>{product.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{product.spec || '규격 없음'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-extrabold text-blue-700 whitespace-nowrap">{product.price.toLocaleString()}원</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 border-t pt-3 mt-2">
                      <button onClick={() => handleEditClick(product)} className="flex-1 text-blue-600 bg-blue-50 font-bold py-2 rounded-lg border border-blue-100 text-sm">
                        수정
                      </button>
                      <button onClick={() => handleToggleActive(product.id, product.is_active)} className={`flex-1 font-bold py-2 rounded-lg border text-sm ${product.is_active ? 'text-yellow-600 bg-yellow-50 border-yellow-100' : 'text-green-600 bg-green-50 border-green-100'}`}>
                        {product.is_active ? '비활성' : '활성'}
                      </button>
                      {/* 신규: 모바일 삭제 버튼 */}
                      <button onClick={() => handleDeleteProduct(product.id)} className="flex-1 text-gray-500 bg-gray-50 font-bold py-2 rounded-lg border border-gray-200 hover:bg-red-50 hover:text-red-500 transition text-sm">
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