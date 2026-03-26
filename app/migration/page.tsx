"use client";

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';

interface Client { id: string; name: string; }

export default function MigrationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      setCompanyId(profile!.company_id);

      const { data: clientData } = await supabase.from('clients').select('id, name').eq('company_id', profile!.company_id);
      setClients(clientData || []);
    };
    init();
  }, [router]);

  // 날짜 안전 변환
  const formatSafeDate = (val: any) => {
    if (!val) return new Date().toISOString().slice(0, 10);
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (typeof val === 'number') {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().slice(0, 10);
    }
    return String(val).replace(/\./g, '-').replace(/\//g, '-').substring(0, 10);
  };

  // === 핵심 방어: 콤마(,) 제거 및 안전한 숫자 변환 ===
  const parseNumber = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // 1,000 같은 문자열에서 콤마를 싹 지우고 숫자로 변환
    const strVal = String(val).replace(/,/g, '');
    return Number(strVal) || 0;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    addLog(`엑셀 파일 읽는 중... (${file.name})`);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        addLog(`총 ${data.length}줄의 데이터 발견됨. 데이터 묶기 시작...`);

        const groupedData: Record<string, { type: string, date: string, clientName: string, items: any[] }> = {};

        data.forEach((row: any) => {
          const rawDocNo = row['전표번호'] || row['문서번호'];
          if (!rawDocNo) return; 
          
          const docNo = String(rawDocNo).trim();
          if (!docNo) return;

          if (!groupedData[docNo]) {
            groupedData[docNo] = {
              type: String(row['구분'] || '').includes('매입') ? 'purchase' : 'sales',
              date: formatSafeDate(row['전표날짜'] || row['일자'] || row['작성일자']),
              clientName: String(row['거래처'] || row['거래처명'] || '알 수 없는 거래처').trim(),
              items: []
            };
          }

          // === 핵심 수정: 수량, 단가, 금액 콤마 완벽 보정 및 역산 ===
          const qty = parseNumber(row['수량']) || 1;
          let price = parseNumber(row['단가']);
          const amount = parseNumber(row['금액']);
          const vat = parseNumber(row['세액'] || row['부가세']);

          // 만약 엑셀에 '단가' 칸이 비어있고 '금액'만 덜렁 적혀있을 경우 단가를 역산해서 살려냄
          if (price === 0 && amount !== 0) {
            price = Math.round(amount / qty);
          }

          groupedData[docNo].items.push({
            name: String(row['품목'] || row['품명'] || '품명 없음').trim(),
            spec: String(row['규격'] || '').trim(),
            qty: qty,
            price: price,
            amount: amount,
            vat: vat,
          });
        });

        const docNumbers = Object.keys(groupedData);
        addLog(`총 ${docNumbers.length}개의 전표(명세서/매입장)로 압축 성공! DB 업로드 시작...`);

        let successCount = 0;
        let failCount = 0;

        for (const docNo of docNumbers) {
          const doc = groupedData[docNo];
          
          const matchedClient = clients.find(c => 
            (c.name || '').replace(/\s/g, '') === doc.clientName.replace(/\s/g, '')
          );

          if (!matchedClient) {
            addLog(`❌ [실패] '${doc.clientName}' 거래처를 시스템에서 찾을 수 없습니다. (전표: ${docNo})`);
            failCount++;
            continue;
          }

          const supplyTotal = doc.items.reduce((sum, item) => sum + item.amount, 0);
          const vatTotal = doc.items.reduce((sum, item) => sum + item.vat, 0);
          const grandTotal = supplyTotal + vatTotal;
          
          const cleanDate = doc.date;
          const generatedNo = `MIG-${cleanDate.replace(/-/g, '')}-${docNo}`;

          try {
            if (doc.type === 'sales') {
              const { data: invData, error: invErr } = await supabase.from('invoices').insert([{
                company_id: companyId, client_id: matchedClient.id, invoice_no: generatedNo,
                created_at: `${cleanDate}T09:00:00Z`, supply_amount: supplyTotal, vat_amount: vatTotal, total_amount: grandTotal
              }]).select().single();
              if (invErr) throw invErr;

              const itemsToInsert = doc.items.map(item => ({
                invoice_id: invData.id, name: item.name, spec: item.spec, qty: item.qty, price: item.price
              }));
              await supabase.from('invoice_items').insert(itemsToInsert);

            } else {
              const { data: purData, error: purErr } = await supabase.from('purchases').insert([{
                company_id: companyId, client_id: matchedClient.id, purchase_no: generatedNo,
                created_at: `${cleanDate}T09:00:00Z`, supply_amount: supplyTotal, vat_amount: vatTotal, total_amount: grandTotal
              }]).select().single();
              if (purErr) throw purErr;

              const itemsToInsert = doc.items.map(item => ({
                purchase_id: purData.id, name: item.name, spec: item.spec, qty: item.qty, price: item.price
              }));
              await supabase.from('purchase_items').insert(itemsToInsert);
            }
            successCount++;
          } catch (e: any) {
            addLog(`❌ [에러] 전표 ${docNo} 저장 중 DB 오류: ${e.message}`);
            failCount++;
          }
        }

        addLog(`🎉 [완료] 업로드 종료! (성공: ${successCount}건 / 실패: ${failCount}건)`);
        alert(`데이터 이관 완료!\n성공: ${successCount}건, 실패: ${failCount}건\n(로그를 확인해주세요)`);

      } catch (error: any) {
        addLog(`❌ 엑셀 파일을 분석하는 도중 치명적인 오류 발생: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-10 flex flex-col items-center justify-center font-sans">
      <div className="max-w-3xl w-full bg-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl border border-gray-700">
        <h1 className="text-2xl md:text-3xl font-extrabold text-blue-400 mb-2">🚀 J-TECH 과거 데이터 마이그레이션</h1>
        <p className="text-gray-400 mb-8 font-bold text-sm md:text-base">기존 거래돌이 엑셀 데이터를 Supabase DB로 쏟아 붓는 전용 페이지입니다.</p>

        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl mb-6">
          <p className="text-red-400 font-extrabold text-sm mb-1">⚠️ 필수 확인사항</p>
          <ul className="text-gray-300 text-sm space-y-1 list-disc pl-5 font-medium">
            <li>반드시 <b>[거래처 관리]</b>에 거래처가 먼저 등록되어 있어야 합니다.</li>
            <li>엑셀 첫 줄 항목명이 정확해야 합니다: <span className="text-white bg-gray-700 px-1 rounded">거래처, 구분, 전표번호, 전표날짜, 품목, 규격, 수량, 단가, 금액, 세액</span></li>
          </ul>
        </div>

        <label className={`w-full flex flex-col items-center justify-center p-8 md:p-10 border-4 border-dashed rounded-2xl cursor-pointer transition ${loading ? 'border-gray-600 bg-gray-700 pointer-events-none' : 'border-blue-500 bg-blue-500/10 hover:bg-blue-500/20'}`}>
          <span className="text-4xl mb-4">{loading ? '⏳' : '📁'}</span>
          <span className="text-lg md:text-xl font-extrabold text-center">{loading ? '데이터 이관 중입니다... (창을 닫지 마세요)' : '클릭하여 거래돌이 엑셀 파일 선택'}</span>
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} disabled={loading} />
        </label>

        {log.length > 0 && (
          <div className="mt-8 bg-black p-4 rounded-xl h-64 overflow-y-auto custom-scrollbar font-mono text-sm border border-gray-700">
            {log.map((msg, idx) => (
              <div key={idx} className={`mb-1.5 ${msg.includes('❌') ? 'text-red-400' : msg.includes('🎉') ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                {msg}
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-6 text-center">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white font-bold underline underline-offset-4">메인 대시보드로 돌아가기</button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #4b5563; border-radius: 10px; }
      ` }} />
    </div>
  );
}