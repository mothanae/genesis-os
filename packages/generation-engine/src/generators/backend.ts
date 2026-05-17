import type { GraphNode } from '@genesis-1/shared';

export interface BackendGenOptions {
  framework: 'express' | 'fastify' | 'nestjs';
  language: 'typescript' | 'javascript';
  orm: 'drizzle' | 'prisma' | 'typeorm';
}

export class BackendGenerator {
  generate(nodes: GraphNode[], options: BackendGenOptions) {
    return nodes
      .filter((n) => ['service', 'function'].includes(n.type))
      .map((node) => ({
        type: 'service' as const,
        path: `src/services/${node.name.toLowerCase().replace(/\s+/g, '-')}.${options.language === 'typescript' ? 'ts' : 'js'}`,
        content: '',
      }));
  }
}
