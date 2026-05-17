import type { GraphNode } from '@genesis-1/shared';

export interface BackendGenOptions {
  framework: 'express' | 'fastify' | 'nestjs';
  language: 'typescript' | 'javascript';
  orm: 'drizzle' | 'prisma' | 'typeorm';
}

interface GeneratedFile {
  type: 'service';
  path: string;
  content: string;
}

export class BackendGenerator {
  generate(nodes: GraphNode[], options: BackendGenOptions): GeneratedFile[] {
    const ext = options.language === 'typescript' ? 'ts' : 'js';
    return nodes
      .filter((n) => ['service', 'function'].includes(n.type))
      .map((node) => {
        const dir = node.type === 'function' ? 'functions' : 'services';
        const path = `src/${dir}/${this.toKebab(node.name)}/index.${ext}`;
        const content = this.generateServiceContent(node, options);
        return { type: 'service' as const, path, content };
      });
  }

  private generateServiceContent(node: GraphNode, options: BackendGenOptions): string {
    switch (options.framework) {
      case 'fastify':
        return this.generateFastifyService(node, options);
      case 'express':
        return this.generateExpressService(node, options);
      case 'nestjs':
        return this.generateNestjsService(node, options);
      default:
        return this.generateFastifyService(node, options);
    }
  }

  private generateFastifyService(node: GraphNode, options: BackendGenOptions): string {
    const ts = options.language === 'typescript';
    const name = this.toPascal(node.name);

    if (ts) {
      return `import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const ${this.toCamel(node.name)}Schema = z.object({
  id: z.string().uuid(),
});

export async function ${name}Routes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return { status: 'healthy', service: '${node.name}' };
  });

  app.get('/', async () => {
    return { service: '${node.name}', uptime: process.uptime() };
  });

  app.post('/', async (request) => {
    const body = ${this.toCamel(node.name)}Schema.safeParse(request.body);
    if (!body.success) {
      return { success: false, error: 'Validation error' };
    }
    return { success: true, data: body.data };
  });
}
`;
    }

    return `import { z } from 'zod';

const ${this.toCamel(node.name)}Schema = z.object({
  id: z.string().uuid(),
});

export async function ${name}Routes(app) {
  app.get('/health', async () => {
    return { status: 'healthy', service: '${node.name}' };
  });

  app.get('/', async () => {
    return { service: '${node.name}', uptime: process.uptime() };
  });
}
`;
  }

  private generateExpressService(node: GraphNode, options: BackendGenOptions): string {
    const ts = options.language === 'typescript';
    const name = this.toPascal(node.name);

    if (ts) {
      return `import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: '${node.name}' });
});

router.get('/', (_req: Request, res: Response) => {
  res.json({ service: '${node.name}', uptime: process.uptime() });
});

export default router;
`;
    }

    return `const { Router } = require('express');

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: '${node.name}' });
});

module.exports = router;
`;
  }

  private generateNestjsService(node: GraphNode, _options: BackendGenOptions): string {
    const name = this.toPascal(node.name);

    return `import { Injectable, Get, Controller, Module } from '@nestjs/common';

@Injectable()
export class ${name}Service {
  healthCheck(): { status: string; service: string } {
    return { status: 'healthy', service: '${node.name}' };
  }
}

@Controller('${this.toKebab(node.name)}')
export class ${name}Controller {
  constructor(private readonly service: ${name}Service) {}

  @Get('health')
  health() {
    return this.service.healthCheck();
  }

  @Get()
  findAll() {
    return { service: '${node.name}', data: [] };
  }
}

@Module({
  controllers: [${name}Controller],
  providers: [${name}Service],
  exports: [${name}Service],
})
export class ${name}Module {}`;
  }

  generateCrudService(node: GraphNode, options: BackendGenOptions): string {
    const ts = options.language === 'typescript';
    const name = this.toPascal(node.name);

    const ormImports = options.orm === 'drizzle'
      ? `import { eq } from 'drizzle-orm';
import { db } from '../database';
import { ${this.toSnake(node.name)} } from '../database/schema';`
      : options.orm === 'prisma'
        ? `import { prisma } from '../database';`
        : `import { AppDataSource } from '../database';
import { ${name} } from '../entities/${name}';`;

    const typeInterfaces = ts ? `export interface Create${name}Input {
  name: string;
}

export interface Update${name}Input {
  name?: string;
}

` : '';

    const classDeclaration = ts
      ? `export class ${name}Repository {
  async findById(id: string) {`
      : `module.exports = class ${name}Repository {
  async findById(id) {`;

    return `${ormImports}

${typeInterfaces}${classDeclaration}
    ${this.generateCrudBody(options)}
  }
}`;
  }

  private generateCrudBody(options: BackendGenOptions): string {
    const name = this.toPascal('entity');
    switch (options.orm) {
      case 'drizzle':
        return `
    const result = await db.select().from(${name}).where(eq(${name}.id, id)).limit(1);
    return result[0] ?? null;
  }

  async findAll(limit = 50, offset = 0) {
    return db.select().from(${name}).limit(limit).offset(offset);
  }

  async create(data: { name: string }) {
    const result = await db.insert(${name}).values(data).returning();
    return result[0];
  }

  async update(id: string, data: { name?: string }) {
    const result = await db.update(${name}).set(data).where(eq(${name}.id, id)).returning();
    return result[0] ?? null;
  }

  async delete(id: string) {
    await db.delete(${name}).where(eq(${name}.id, id));
    return true;
  }`;
      case 'prisma':
        return `
    return prisma.${name.toLowerCase()}.findUnique({ where: { id } });
  }

  async findAll(limit = 50, offset = 0) {
    return prisma.${name.toLowerCase()}.findMany({ take: limit, skip: offset });
  }

  async create(data: { name: string }) {
    return prisma.${name.toLowerCase()}.create({ data });
  }

  async update(id: string, data: { name?: string }) {
    return prisma.${name.toLowerCase()}.update({ where: { id }, data });
  }

  async delete(id: string) {
    await prisma.${name.toLowerCase()}.delete({ where: { id } });
    return true;
  }`;
      default:
        return `
    const repo = AppDataSource.getRepository(${name});
    return repo.findOneBy({ id });
  }

  async findAll(limit = 50, offset = 0) {
    const repo = AppDataSource.getRepository(${name});
    return repo.find({ take: limit, skip: offset });
  }

  async create(data: { name: string }) {
    const repo = AppDataSource.getRepository(${name});
    return repo.save(repo.create(data));
  }

  async update(id: string, data: { name?: string }) {
    const repo = AppDataSource.getRepository(${name});
    await repo.update(id, data);
    return this.findById(id);
  }

  async delete(id: string) {
    const repo = AppDataSource.getRepository(${name});
    await repo.delete(id);
    return true;
  }`;
    }
  }

  generateMiddleware(_node: GraphNode, options: BackendGenOptions): string {
    const ts = options.language === 'typescript';

    if (ts) {
      return `import type { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }
  try {
    (req as Record<string, unknown>).user = { id: 'user-id', role: 'user' };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
}
`;
    }

    return `function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  try {
    req.user = { id: 'user-id', role: 'user' };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { authMiddleware, errorHandler };
`;
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

  private toCamel(s: string): string {
    const pascal = this.toPascal(s);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private toSnake(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }
}
