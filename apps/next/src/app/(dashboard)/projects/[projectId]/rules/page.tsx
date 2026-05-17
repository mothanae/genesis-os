'use client';
import { useParams } from 'next/navigation';
export default function RulesPage() {
  const p = useParams();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Rule Engine</h1>
      <p className="text-sm text-gray-500 mt-1">Project: {p.projectId as string}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[{name:'Graph Architecture',count:6},{name:'Security Validator',count:3},{name:'Scalability Validator',count:3}].map(r=>(
          <div key={r.name} className="border rounded-lg p-4 hover:shadow-md">
            <div className="text-lg mb-1">📋</div>
            <div className="font-semibold text-sm">{r.name}</div>
            <div className="text-xs text-gray-500">{r.count} rules</div>
          </div>
        ))}
      </div>
    </div>
  );
}
