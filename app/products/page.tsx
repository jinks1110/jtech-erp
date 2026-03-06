"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 타입 지정 (빌드 에러 및 런타임 타입 오류 완벽 방지)
interface Product {
  id: string;
  name: string;
  spec: string;
  price: number;
  is_vat_included: boolean;
}

// 제이테크 품목 관리 페이지 (모바일 반응형 및 한 손 입력 최적화)
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 폼 상태 관리
  const [name, setName] = useState('');
  const [spec, setSpec] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [isVatIncluded, setIsVatIncluded] = useState(false);

  // 1. 품목 목록 불러오기 (Read)
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('품목 불러오기 에러:', error.message);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 2. 품목 추가하기 (Create)
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price === '') {
      alert('품목명과 단가는 필수 입력 사항입니다.');
      return;
    }

    try {
      // 본사(제이테크) ID 매핑 (인서트 에러 방지)
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .single();

      if (companyError || !companyData) throw new Error('등록된 본사 정보가 없습니다.');

      const { error } = await supabase
        .from('products')
        .insert([
          {
            company_id: companyData.id,
            name,
            spec,
            price: Number(price),
            is_vat_included: isVatIncluded
          }
        ]);

      if (error) throw error;

      alert('품목이 성공적으로 등록되었습니다.');
      // 폼 초기화
      setName('');
      setSpec('');
      setPrice('');
      setIsVatIncluded(false);
      // 목록 새로고침
      fetchProducts();

    } catch (error: any) {
      console.error('품목 등록 에러:', error.message);
      alert(error.message || '품목 등록에 실패했습니다.');
    }
  };

  // 3. 품목 삭제하기 (Delete)
  const handleDelete = async (id: string) => {
    if (!window.confirm('이 품목을 삭제하시겠습니까? (기존 거래명세표에 기록된 데이터는 안전하게 보존됩니다)')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      alert('삭제되었습니다.');
      fetchProducts();
    } catch (error: any) {
      console.error('삭제 에러:', error.message);
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 왼쪽: 품목 등록 폼 */}
        <div className="bg-white p-6 shadow-lg rounded-lg h-fit">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">신규 품목 등록</h2>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">품목명 (필수)</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500" placeholder="예: 와이어 하네스 A형" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">규격</label>
              <input type="text" value={spec} onChange={(e) => setSpec(e.target.value)} className="w-full border rounded p-2 outline-none focus:border-blue-500" placeholder="예: 200mm, AWG24" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">단가 (필수)</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border rounded p-2 outline-none focus:border-blue-500 text-right" placeholder="0" required />
            </div>
            <div className="flex items-center mt-2">
              <input type="checkbox" id="vat" checked={isVatIncluded} onChange={(e) => setIsVatIncluded(e.target.checked)} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
              <label htmlFor="vat" className="ml-2 text-sm font-medium text-gray-900">부가세 포함 단가</label>
            </div>
            <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700 transition mt-4">
              품목 등록
            </button>
          </form>
        </div>

        {/* 오른쪽: 품목 목록 리스트 */}
        <div className="md:col-span-2 bg-white p-6 shadow-lg rounded-lg">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">품목 단가표</h2>
          
          {loading ? (
            <p className="text-center text-gray-500 py-10">데이터를 불러오는 중입니다...</p>
          ) : products.length === 0 ? (
            <p className="text-center text-gray-500 py-10">등록된 품목이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm">
                    <th className="p-3 border">품목명</th>
                    <th className="p-3 border">규격</th>
                    <th className="p-3 border text-right">단가</th>
                    <th className="p-3 border text-center">부가세</th>
                    <th className="p-3 border text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-gray-50 text-sm">
                      <td className="p-3 font-medium">{product.name}</td>
                      <td className="p-3 text-gray-600">{product.spec || '-'}</td>
                      <td className="p-3 text-right font-medium">{product.price.toLocaleString()}원</td>
                      <td className="p-3 text-center">
                        {product.is_vat_included ? (
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">포함</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">별도</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:text-red-700 font-bold px-2 py-1 border border-red-200 rounded">
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