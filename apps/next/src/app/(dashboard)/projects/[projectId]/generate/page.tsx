'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
export default function GeneratePage() {
  const p = useParams(); const pid = p.projectId as string;
  const [stack, setStack] = useState('nodejs');
  const [result, setResult] = useState<any>(null);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Code Generation</h1>
      <div className="flex gap-3 mt-4">
        <select value={stack} onChange={(e) => setStack(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
          {['react','nextjs','nodejs','fastapi','laravel','django','golang','rust'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={async()=>{const r=await apiClient<any>(`/api/v1/projects/${pid}/generate`,{method:'POST',body:{targetStack:stack}});setResult(r);}} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm">Generate</button>
      </div>
      {result && <div className="mt-4 grid grid-cols-4 gap-3">{['totalFiles','totalLines'].map(k=><div key={k} className="bg-white border rounded-lg p-3 text-center"><div className="text-xl font-bold text-blue-600">{result.stats?.[k]??0}</div><div className="text-xs text-gray-500">{k}</div></div>)}</div>}
    </div>
  );
}
