import type { DatabaseClient } from '../client';
import type { PgTable } from 'drizzle-orm/pg-core';
import { eq, and } from 'drizzle-orm';

export class BaseRepository<T extends Record<string, unknown>> {
  constructor(
    protected readonly db: DatabaseClient,
    protected readonly table: PgTable,
  ) {}

  async findById(id: string): Promise<T | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq((this.table as unknown as Record<string, unknown>).id as never, id))
      .limit(1);
    return (result[0] as T) ?? null;
  }

  async findMany(where?: Record<string, unknown>, limit = 50, offset = 0): Promise<T[]> {
    let query = this.db.select().from(this.table);

    if (where) {
      const conditions = Object.entries(where).map(([key, value]) =>
        eq((this.table as unknown as Record<string, unknown>)[key] as never, value),
      );
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query.limit(limit).offset(offset);
    return result as T[];
  }

  async create(data: Record<string, unknown>): Promise<T> {
    const result = await this.db
      .insert(this.table)
      .values(data as never)
      .returning();
    return result[0] as T;
  }

  async update(id: string, data: Record<string, unknown>): Promise<T | null> {
    const result = await this.db
      .update(this.table)
      .set(data as never)
      .where(eq((this.table as unknown as Record<string, unknown>).id as never, id))
      .returning();
    return (result[0] as T) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq((this.table as unknown as Record<string, unknown>).id as never, id))
      .returning();
    return result.length > 0;
  }
}
