import type { GraphNode } from '@genesis-1/shared';

export interface FrontendGenOptions {
  framework: 'react' | 'nextjs';
  styling: 'tailwind' | 'css-modules';
  typescript: boolean;
}

interface GeneratedFile {
  type: 'component';
  path: string;
  content: string;
}

export class FrontendGenerator {
  generate(nodes: GraphNode[], options: FrontendGenOptions): GeneratedFile[] {
    const ext = options.typescript ? 'tsx' : 'jsx';
    return nodes
      .filter((n) => ['page', 'component', 'form', 'table', 'chart'].includes(n.type))
      .map((node) => {
        const path = `src/${node.type}s/${this.toKebab(node.name)}.${ext}`;
        const content = this.generateNodeContent(node, options);
        return { type: 'component' as const, path, content };
      });
  }

  private generateNodeContent(node: GraphNode, options: FrontendGenOptions): string {
    const name = this.toPascal(node.name);

    switch (node.type) {
      case 'page':
        return this.generatePage(name, node, options);
      case 'component':
        return this.generateComponent(name, node, options);
      case 'form':
        return this.generateForm(name, node, options);
      case 'table':
        return this.generateTable(name, node, options);
      case 'chart':
        return this.generateChart(name, node, options);
      default:
        return this.generateComponent(name, node, options);
    }
  }

  private generatePage(name: string, node: GraphNode, options: FrontendGenOptions): string {
    const ext = options.typescript ? 'tsx' : 'jsx';
    const className = options.styling === 'tailwind'
      ? 'min-h-screen container mx-auto p-4'
      : 'styles.container';

    const imports = options.typescript
      ? ''
      : '';

    return `import { Metadata } from 'next';
${imports}
${options.typescript ? `export const metadata: Metadata = {
  title: '${name}',
  description: '${node.description ?? name} page',
};

` : ''}export default function ${name}Page() {
  return (
    <div className="${className}">
      <h1 className="text-2xl font-bold mb-4">${name}</h1>
      <p className="text-gray-600">${node.description ?? ''}</p>
    </div>
  );
}`;
  }

  private generateComponent(name: string, node: GraphNode, options: FrontendGenOptions): string {
    const isTypeScript = options.typescript;

    return `${isTypeScript ? `export interface ${name}Props {
  className?: string;
}

` : ''}export function ${name}(${isTypeScript ? `{ className = '' }: ${name}Props` : '{ className }'}) {
  return (
    <div className={\`rounded-lg border p-4 \${className}\`}>
      <h2 className="text-lg font-semibold">${name}</h2>
      {${isTypeScript ? '/* Children go here */' : '/* Children go here */'}}
    </div>
  );
}`;
  }

  private generateForm(name: string, node: GraphNode, options: FrontendGenOptions): string {
    const isTypeScript = options.typescript;

    return `import { useState } from 'react';
${isTypeScript ? `
interface ${name}FormData {
  email: string;
  password: string;
}
` : ''}
export function ${name}() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
${isTypeScript ? `  const [formData, setFormData] = useState<${name}FormData>({
    email: '',
    password: '',
  });` : `  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });`}

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // TODO: Wire to API endpoint
      const res = await fetch('/api/${this.toKebab(node.name)}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Submission failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
        className="w-full rounded-lg border px-4 py-2"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={formData.password}
        onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
        className="w-full rounded-lg border px-4 py-2"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}`;
  }

  private generateTable(name: string, node: GraphNode, options: FrontendGenOptions): string {
    const isTypeScript = options.typescript;

    return `${isTypeScript ? `export interface ${name}Row {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface ${name}Props {
  data: ${name}Row[];
  onRowClick?: (row: ${name}Row) => void;
}

` : ''}export function ${name}(${isTypeScript ? `{ data, onRowClick }: ${name}Props` : '{ data, onRowClick }'}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-4 py-3">{row.name}</td>
              <td className="px-4 py-3">
                <span className={\`inline-flex rounded-full px-2 py-0.5 text-xs font-medium \${
                  row.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }\`}>
                  {row.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(row.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}`;
  }

  private generateChart(name: string, node: GraphNode, options: FrontendGenOptions): string {
    const isTypeScript = options.typescript;

    return `${isTypeScript ? `export interface ${name}DataPoint {
  label: string;
  value: number;
}

export interface ${name}Props {
  data: ${name}DataPoint[];
  height?: number;
}

` : ''}export function ${name}(${isTypeScript ? `{ data, height = 200 }: ${name}Props` : '{ data, height = 200 }'}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-4">${name}</h3>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((point, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <div
              className="w-full rounded-t bg-blue-500 hover:bg-blue-600 transition-colors"
              style={{ height: \`\${(point.value / maxValue) * 100}%\` }}
              title={\`\${point.label}: \${point.value}\`}
            />
            <span className="text-xs text-gray-500 truncate max-w-full">
              {point.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}`;
  }

  private toKebab(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  private toPascal(s: string): string {
    return s
      .split(/[\s-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  }
}
