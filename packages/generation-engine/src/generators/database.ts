import type { GraphNode } from '@genesis-1/shared';

export interface DatabaseGenOptions {
  orm: 'drizzle' | 'prisma' | 'typeorm';
  dialect: 'postgresql' | 'mysql' | 'sqlite';
}

export class DatabaseGenerator {
  generate(nodes: GraphNode[], options: DatabaseGenOptions) {
    return nodes
      .filter((n) => ['database', 'cache', 'queue', 'event_store', 'object_store'].includes(n.type))
      .map((node) => ({
        type: 'schema' as const,
        path: `database/schema/${node.name.toLowerCase().replace(/\s+/g, '_')}.ts`,
        content: '',
      }));
  }
}
