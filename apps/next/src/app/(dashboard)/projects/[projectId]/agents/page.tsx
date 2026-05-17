'use client';
import { useParams } from 'next/navigation';
export default function AgentsPage() {
  const p = useParams();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Agent Orchestration</h1>
      <p className="text-sm text-gray-500 mt-1">Project: {p.projectId as string}</p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {['Architecture Planner', 'Frontend Generator', 'Backend Generator', 'API Generator', 'Database Generator', 'Infra Generator', 'Validator', 'Simulator', 'Deploy', 'Documentation'].map((a) => (
          <div key={a} className="border rounded-lg p-4 hover:shadow-md cursor-pointer">
            <div className="text-lg mb-1">🤖</div>
            <div className="font-semibold text-sm">{a}</div>
            <div className="text-xs text-gray-500 mt-1">Specialist agent</div>
          </div>
        ))}
      </div>
    </div>
  );
}
