'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { MonacoCodeEditor } from '@/components/code/monaco-editor';

interface DiagramViewerProps {
  projectId: string;
}

export function DiagramViewer({ projectId }: DiagramViewerProps) {
  const [mermaidCode, setMermaidCode] = useState<string>('');
  const [format, setFormat] = useState<string>('mermaid');
  const [allFormats, setAllFormats] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<string>('TB');
  const [showRuntime, setShowRuntime] = useState(false);
  const [groupByEnv, setGroupByEnv] = useState(false);

  const loadDiagram = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<{ allFormats?: Record<string, string>; diagram: string; errors?: string[] }>(`/api/v1/projects/${projectId}/graph/diagram`, {
        method: 'POST',
        body: {
          format: 'all',
          direction,
          title: 'Architecture Diagram',
          showRuntime,
          groupByEnvironment: groupByEnv,
        },
      });
      if (data.allFormats) {
        setAllFormats(data.allFormats);
        setMermaidCode(data.allFormats[format] ?? data.diagram);
      } else {
        setMermaidCode(data.diagram);
      }
    } catch (err) {
      setMermaidCode('%% Failed to generate diagram');
    } finally {
      setLoading(false);
    }
  }, [projectId, format, direction, showRuntime, groupByEnv]);

  useEffect(() => { loadDiagram(); }, [loadDiagram]);

  // Simple Mermaid renderer using inline SVG approach
  // For production, use mermaid.js library: `npm install mermaid`
  const nodeCount = (mermaidCode.match(/\[/g) ?? []).length;
  const edgeCount = (mermaidCode.match(/-->/g) ?? []).length;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={format}
          onChange={(e) => {
            setFormat(e.target.value);
            if (allFormats?.[e.target.value]) {
              setMermaidCode(allFormats[e.target.value]!);
            }
          }}
          className="border rounded px-2 py-1 text-xs"
        >
          <option value="mermaid">Mermaid</option>
          <option value="graphviz">Graphviz (DOT)</option>
          <option value="d2">D2</option>
          <option value="plantuml">PlantUML</option>
        </select>

        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="border rounded px-2 py-1 text-xs"
        >
          <option value="TB">Top → Bottom</option>
          <option value="LR">Left → Right</option>
          <option value="RL">Right → Left</option>
          <option value="BT">Bottom → Top</option>
        </select>

        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={showRuntime}
            onChange={(e) => setShowRuntime(e.target.checked)}
          />
          Show Runtime
        </label>

        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={groupByEnv}
            onChange={(e) => setGroupByEnv(e.target.checked)}
          />
          Group by Environment
        </label>

        <button
          onClick={loadDiagram}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>

        {/* Copy button */}
        <button
          onClick={() => navigator.clipboard.writeText(mermaidCode)}
          className="px-3 py-1 border rounded text-xs hover:bg-gray-50"
        >
          Copy Code
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span>{nodeCount} nodes</span>
        <span>{edgeCount} edges</span>
        <span>{mermaidCode.split('\n').length} lines</span>
        <span>{format.toUpperCase()} format</span>
      </div>

      {/* Mermaid Preview (text-based rendering) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-1 gap-4"
      >
        {/* Code view */}
        <MonacoCodeEditor
          code={mermaidCode}
          language="markdown"
          readOnly={false}
          onChange={setMermaidCode}
          height="400px"
        />

        {/* If multiple formats */}
        {allFormats && (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(allFormats)
              .filter(([k]) => k !== format)
              .slice(0, 3)
              .map(([fmt, code]) => (
                <div key={fmt} className="border rounded p-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">{fmt}</h3>
                  <pre className="text-[10px] text-gray-600 overflow-x-auto max-h-32">
                    {code.slice(0, 500)}{code.length > 500 ? '...' : ''}
                  </pre>
                </div>
              ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
