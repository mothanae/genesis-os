'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
export default function EvolvePage() {
  const p = useParams(); const pid = p.projectId as string;
  const [insights, setInsights] = useState<any[]>([]);
  useEffect(() => { apiClient<any>(`/api/v1/projects/${pid}/insights`).then(r => setInsights(r.data??[])).catch(()=>{}); }, [pid]);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Evolution Engine</h1>
      <div className="mt-4 space-y-3">
        {insights.map((i:any) => (
          <div key={i.id} className={`border rounded-lg p-4 ${i.severity==='critical'?'border-red-300 bg-red-50':i.severity==='warning'?'border-yellow-300 bg-yellow-50':'border-blue-200 bg-blue-50'}`}>
            <div className="flex items-center gap-2"><span className="font-semibold text-sm">{i.title}</span><span className="text-xs px-1.5 py-0.5 rounded bg-white">{i.type}</span></div>
            <p className="text-xs text-gray-600 mt-1">{i.description}</p>
            <p className="text-xs text-gray-500 mt-1 italic">{i.suggestion}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
