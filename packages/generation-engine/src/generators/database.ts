import type { GraphNode } from '@genesis-1/shared';

export interface DatabaseGenOptions {
  orm: 'drizzle' | 'prisma' | 'typeorm';
  dialect: 'postgresql' | 'mysql' | 'sqlite';
}

interface GeneratedFile {
  type: 'schema';
  path: string;
  content: string;
}

export class DatabaseGenerator {
  generate(nodes: GraphNode[], options: DatabaseGenOptions): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const dbNodes = nodes.filter((n) =>
      ['database', 'cache', 'queue', 'event_store', 'object_store'].includes(n.type),
    );

    for (const node of dbNodes) {
      const tableName = this.toSnake(node.name);
      files.push({
        type: 'schema' as const,
        path: `database/schema/${tableName}.ts`,
        content: this.generateTableSchema(node, tableName, options),
      });
    }

    // Generate migration index if there are schema files
    if (dbNodes.length > 0) {
      files.push({
        type: 'schema' as const,
        path: 'database/index.ts',
        content: this.generateDatabaseIndex(dbNodes, options),
      });
    }

    return files;
  }

  private generateTableSchema(node: GraphNode, tableName: string, options: DatabaseGenOptions): string {
    const switch_ = options.orm;
    switch (switch_) {
      case 'drizzle':
        return this.generateDrizzleTable(node, tableName, options.dialect);
      case 'prisma':
        return this.generatePrismaModel(node, tableName, options.dialect);
      case 'typeorm':
        return this.generateTypeOrmEntity(node, tableName);
      default:
        return this.generateDrizzleTable(node, tableName, options.dialect);
    }
  }

  private generateDrizzleTable(node: GraphNode, tableName: string, dialect: string): string {
    const columns = this.inferColumns(node, dialect);
    const isPg = dialect === 'postgresql';

    return `// Generated schema: ${node.name}
import { ${isPg ? 'pgTable, uuid, text, integer, jsonb, timestamp, boolean' : 'sqliteTable, text, integer, blob'} } from 'drizzle-orm/${isPg ? 'pg-core' : 'sqlite-core'}';

export const ${tableName} = ${isPg ? 'pgTable' : 'sqliteTable'}('${tableName}', {
${columns.map((col) => `  ${col.name}: ${col.drizzleType},`).join('\n')}
});
`;
  }

  private generatePrismaModel(node: GraphNode, tableName: string, dialect: string): string {
    const pascal = this.toPascal(node.name);
    const isPg = dialect === 'postgresql';

    return `// Generated model: ${node.name}
model ${pascal} {
  id        String   @id @default(uuid())
${node.type === 'cache'
  ? `  key       String   @unique
  value     Json
  expiresAt DateTime?`
  : node.type === 'queue' || node.type === 'event_store'
    ? `  eventType String   @map("event_type")
  payload   Json
  processedAt DateTime? @map("processed_at")`
    : node.type === 'object_store'
      ? `  bucket      String
  objectKey   String   @map("object_key")
  sizeBytes   Int      @map("size_bytes")
  contentType String?  @map("content_type")`
      : `  name      String
  data      Json?`}
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
${node.description ? `
  @@map("${tableName}")` : ''}
}
`;
  }

  private generateTypeOrmEntity(node: GraphNode, tableName: string): string {
    const pascal = this.toPascal(node.name);

    return `// Generated entity: ${node.name}
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('${tableName}')
export class ${pascal} {
  @PrimaryGeneratedColumn('uuid')
  id: string;

${node.type === 'cache'
  ? `  @Column({ type: 'text', unique: true })
  key: string;

  @Column({ type: 'jsonb' })
  value: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
  expiresAt: Date | null;`
  : node.type === 'queue' || node.type === 'event_store'
    ? `  @Column({ type: 'text', name: 'event_type' })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true, name: 'processed_at' })
  processedAt: Date | null;`
    : node.type === 'object_store'
      ? `  @Column({ type: 'text' })
  bucket: string;

  @Column({ type: 'text', name: 'object_key' })
  objectKey: string;

  @Column({ type: 'integer', name: 'size_bytes' })
  sizeBytes: number;

  @Column({ type: 'text', nullable: true, name: 'content_type' })
  contentType: string | null;`
      : `  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;`}

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
`;
  }

  generateMigration(nodes: GraphNode[], options: DatabaseGenOptions): string {
    const timestamp = Date.now();
    const tables = nodes
      .filter((n) => ['database', 'cache', 'queue', 'event_store', 'object_store'].includes(n.type));

    if (tables.length === 0) return '-- No tables to migrate';

    const isPg = options.dialect === 'postgresql';

    return `-- Generated migration: ${timestamp}
-- Dialect: ${options.dialect}
-- Tables: ${tables.map((t) => this.toSnake(t.name)).join(', ')}

${tables.map((node) => {
  const tableName = this.toSnake(node.name);
  if (isPg) {
    return `CREATE TABLE IF NOT EXISTS "${tableName}" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
${node.type === 'cache'
  ? `  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,`
  : node.type === 'queue' || node.type === 'event_store'
    ? `  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  processed_at TIMESTAMP WITH TIME ZONE,`
    : node.type === 'object_store'
      ? `  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,`
      : `  name TEXT NOT NULL,
  data JSONB,`}
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON "${tableName}" (created_at);`;
  } else if (options.dialect === 'mysql') {
    return `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
  id VARCHAR(36) PRIMARY KEY,
${node.type === 'cache'
  ? `  \`key\` VARCHAR(255) UNIQUE NOT NULL,
  value JSON NOT NULL,
  expires_at TIMESTAMP NULL,`
  : node.type === 'queue' || node.type === 'event_store'
    ? `  event_type VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  processed_at TIMESTAMP NULL,`
    : node.type === 'object_store'
      ? `  bucket VARCHAR(255) NOT NULL,
  object_key VARCHAR(500) NOT NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  content_type VARCHAR(100) NULL,`
      : `  name VARCHAR(255) NOT NULL,
  data JSON NULL,`}
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_${tableName}_created_at ON \`${tableName}\` (created_at);`;
  } else {
    return `CREATE TABLE IF NOT EXISTS "${tableName}" (
  id TEXT PRIMARY KEY,
${node.type === 'cache'
  ? `  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  expires_at TEXT,`
  : node.type === 'queue' || node.type === 'event_store'
    ? `  event_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  processed_at TEXT,`
    : node.type === 'object_store'
      ? `  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,`
      : `  name TEXT NOT NULL,
  data TEXT,`}
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON "${tableName}" (created_at);`;
  }
}).join('\n\n')}`;
  }

  private generateDatabaseIndex(nodes: GraphNode[], options: DatabaseGenOptions): string {
    const schemas = nodes
      .filter((n) => ['database', 'cache', 'queue', 'event_store', 'object_store'].includes(n.type));

    if (options.orm === 'drizzle') {
      return `// Generated database index
export { ${schemas.map((n) => this.toSnake(n.name)).join(', ')} } from './schema/${schemas[0] ? this.toSnake(schemas[0].name) : 'app'}';
`;
    }

    return `// Generated database index
// ORM: ${options.orm}
// Dialect: ${options.dialect}
export * from './schema';
`;
  }

  private inferColumns(node: GraphNode, dialect: string): Array<{ name: string; drizzleType: string }> {
    const isPg = dialect === 'postgresql';
    const uuid = isPg ? "uuid('id').primaryKey().defaultRandom()" : "text('id').primaryKey()";

    const base = [
      { name: 'id', drizzleType: uuid },
    ];

    switch (node.type) {
      case 'cache':
        base.push(
          { name: 'key', drizzleType: "text('key').unique().notNull()" },
          { name: 'value', drizzleType: isPg ? "jsonb('value').notNull()" : "text('value').notNull()" },
          { name: 'expires_at', drizzleType: isPg ? "timestamp('expires_at', { withTimezone: true })" : "text('expires_at')" },
        );
        break;
      case 'queue':
      case 'event_store':
        base.push(
          { name: 'event_type', drizzleType: "text('event_type').notNull()" },
          { name: 'payload', drizzleType: isPg ? "jsonb('payload').notNull().default({})" : "text('payload').notNull().default('{}')" },
          { name: 'processed_at', drizzleType: isPg ? "timestamp('processed_at', { withTimezone: true })" : "text('processed_at')" },
        );
        break;
      case 'object_store':
        base.push(
          { name: 'bucket', drizzleType: "text('bucket').notNull()" },
          { name: 'object_key', drizzleType: "text('object_key').notNull()" },
          { name: 'size_bytes', drizzleType: "integer('size_bytes').notNull().default(0)" },
          { name: 'content_type', drizzleType: "text('content_type')" },
        );
        break;
      default:
        base.push(
          { name: 'name', drizzleType: "text('name').notNull()" },
          { name: 'data', drizzleType: isPg ? "jsonb('data')" : "text('data')" },
        );
    }

    base.push(
      { name: 'created_at', drizzleType: isPg ? "timestamp('created_at', { withTimezone: true }).notNull().defaultNow()" : "text('created_at').notNull().default(sql`(datetime('now'))`)" },
      { name: 'updated_at', drizzleType: isPg ? "timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()" : "text('updated_at').notNull().default(sql`(datetime('now'))`)" },
    );

    return base;
  }

  private toSnake(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  private toPascal(s: string): string {
    return s
      .split(/[\s-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  }
}
