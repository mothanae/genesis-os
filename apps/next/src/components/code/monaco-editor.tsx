'use client';

import { useState, useCallback } from 'react';
import Editor, { DiffEditor, type OnMount } from '@monaco-editor/react';

interface MonacoCodeEditorProps {
  code: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  height?: string;
  theme?: 'vs-dark' | 'vs-light';
}

export function MonacoCodeEditor({
  code,
  language = 'typescript',
  readOnly = false,
  onChange,
  height = '400px',
  theme = 'vs-dark',
}: MonacoCodeEditorProps) {
  const [editorRef, setEditorRef] = useState<any>(null);

  const handleMount: OnMount = useCallback((editor) => {
    setEditorRef(editor);

    // Configure editor
    editor.updateOptions({
      minimap: { enabled: true, scale: 0.8 },
      fontSize: 13,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      tabSize: 2,
      wordWrap: 'on',
      bracketPairColorization: { enabled: true },
      autoClosingBrackets: 'always',
      suggest: { showWords: true },
    });

    // Keyboard shortcuts
    editor.addAction({
      id: 'save-code',
      label: 'Save Code',
      keybindings: [2048 | 49], // Ctrl+S
      run: (ed) => {
        const value = ed.getValue();
        onChange?.(value);
      },
    });
  }, [onChange]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        onChange?.(value);
      }
    },
    [onChange],
  );

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 uppercase tracking-wider">{language}</span>
          {readOnly && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900 text-yellow-400">
              Read Only
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>Lines: {code.split('\n').length}</span>
          <span className="mx-1">|</span>
          <span>Chars: {code.length}</span>
        </div>
      </div>

      {/* Editor */}
      <Editor
        height={height}
        language={language}
        value={code}
        theme={theme}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          readOnly,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 8 },
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400 text-sm">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}

/**
 * Code diff viewer using Monaco's diff editor.
 */
export function MonacoDiffEditor({
  original,
  modified,
  language = 'typescript',
  height = '400px',
}: {
  original: string;
  modified: string;
  language?: string;
  height?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-xs text-gray-400">
        <span className="flex-1">Original</span>
        <span className="flex-1 text-right">Modified</span>
      </div>
      <DiffEditor
        height={height}
        language={language}
        original={original}
        modified={modified}
        theme="vs-dark"
        options={{
          readOnly: true,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
