import type { GraphNode } from '@genesis-1/shared';

export interface FrontendGenOptions {
  framework: 'react' | 'nextjs';
  styling: 'tailwind' | 'css-modules';
  typescript: boolean;
}

export class FrontendGenerator {
  generate(nodes: GraphNode[], options: FrontendGenOptions) {
    return nodes
      .filter((n) => ['page', 'component', 'form', 'table', 'chart'].includes(n.type))
      .map((node) => ({
        type: 'component' as const,
        path: `src/${node.type}s/${node.name.toLowerCase().replace(/\s+/g, '-')}.${options.typescript ? 'tsx' : 'jsx'}`,
        content: '',
      }));
  }
}
