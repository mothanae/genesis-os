'use client';
import { useParams } from 'next/navigation';
export default function SimsPage() {
  const p = useParams();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Runtime Simulations</h1>
      <p className="text-sm text-gray-500 mt-1">Project: {p.projectId as string}</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {['HTTP Traffic','DB Queries','Pub/Sub Events','Auth Flow','Background Jobs','WebSocket'].map(s=>(
          <div key={s} className="border rounded-lg p-4 hover:shadow-md">
            <div className="text-lg mb-1">📊</div>
            <div className="font-semibold text-sm">{s}</div>
            <div className="text-xs text-gray-500">Simulation generator</div>
          </div>
        ))}
      </div>
    </div>
  );
}
