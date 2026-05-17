'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface GeneratedModule {
  path: string;
  content: string;
  language: string;
  type: string;
}

interface GenerationResult {
  success: boolean;
  modules: GeneratedModule[];
  errors: string[];
  stats: {
    totalFiles: number;
    totalLines: number;
    languages: string[];
    durationMs: number;
  };
}

const STACK_OPTIONS = [
  { value: 'react', label: 'React', emoji: '⚛️' },
  { value: 'nextjs', label: 'Next.js', emoji: '▲' },
  { value: 'nodejs', label: 'Node.js', emoji: '🟢' },
  { value: 'fastapi', label: 'FastAPI', emoji: '🐍' },
  { value: 'laravel', label: 'Laravel', emoji: '🔺' },
  { value: 'django', label: 'Django', emoji: '🐍' },
  { value: 'golang', label: 'Golang', emoji: '🔵' },
  { value: 'rust', label: 'Rust', emoji: '🦀' },
];

export default function GeneratePage() {
  const { projectId } = useParams();
  const [stack, setStack] = useState('nodejs');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<number | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const r = await apiClient<GenerationResult>(`/api/v1/projects/${projectId}/generate`, {
        method: 'POST',
        body: { targetStack: stack },
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const typeBadges: Record<string, string> = {
    component: 'bg-purple-100 text-purple-700',
    service: 'bg-blue-100 text-blue-700',
    route: 'bg-green-100 text-green-700',
    schema: 'bg-orange-100 text-orange-700',
    config: 'bg-gray-100 text-gray-700',
    test: 'bg-teal-100 text-teal-700',
    docs: 'bg-indigo-100 text-indigo-700',
    docker: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Code Generation</h1>
      <p className="text-sm text-gray-500 mt-1">Project: {projectId as string}</p>

      {/* Controls */}
      <div className="flex gap-3 mt-4">
        <select
          value={stack}
          onChange={(e) => setStack(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm bg-white"
        >
          {STACK_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.emoji} {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Result Stats */}
      {result && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{result.stats.totalFiles}</div>
              <div className="text-xs text-gray-500">Files Generated</div>
            </div>
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{result.stats.totalLines}</div>
              <div className="text-xs text-gray-500">Lines of Code</div>
            </div>
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">{result.stats.languages.length}</div>
              <div className="text-xs text-gray-500">Languages</div>
            </div>
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{(result.stats.durationMs / 1000).toFixed(1)}s</div>
              <div className="text-xs text-gray-500">Duration</div>
            </div>
          </div>

          {/* Languages used */}
          <div className="flex gap-2 flex-wrap">
            {result.stats.languages.map((lang) => (
              <span key={lang} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                {lang}
              </span>
            ))}
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <h3 className="text-sm font-semibold text-red-700 mb-1">Errors</h3>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-600">{err}</p>
              ))}
            </div>
          )}

          {/* Generated Modules */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-gray-700">
              Generated Modules ({result.modules.length})
            </h3>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {result.modules.map((mod, i) => (
                <div key={i}>
                  <button
                    onClick={() => setExpandedModule(expandedModule === i ? null : i)}
                    className="w-full text-left border rounded p-2 hover:bg-gray-50 transition flex items-center gap-2 text-sm"
                  >
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeBadges[mod.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {mod.type}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{mod.language}</span>
                    <span className="text-xs truncate flex-1">{mod.path}</span>
                    <span className="text-xs text-gray-400">{mod.content.split('\n').length} lines</span>
                  </button>
                  {expandedModule === i && (
                    <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded-b overflow-x-auto max-h-[300px]">
                      <code>{mod.content}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
