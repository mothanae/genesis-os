import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseRepository } from '../repository/base.repository';
import type { PgTable } from 'drizzle-orm/pg-core';

function createMockDb() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  return {
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    }),
    _chain: chain,
  };
}

function makeMockTable(): PgTable {
  return { _$brand: 'PgTable' } as unknown as PgTable;
}

type TestRecord = Record<string, unknown> & {
  id: string;
  name: string;
  createdAt: string;
};

describe('BaseRepository', () => {
  let repo: BaseRepository<TestRecord>;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    repo = new BaseRepository<TestRecord>(db as never, makeMockTable());
  });

  // ── findById ────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the record when found', async () => {
      const record = { id: '1', name: 'test', createdAt: new Date().toISOString() };
      db._chain.limit.mockReturnThis();
      db._chain.returning = undefined as never;
      // For select queries, the chain itself resolves
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([record]),
          }),
        }),
      });

      // Recreate repo with this mock structure
      const mockDb2 = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([record]),
            }),
          }),
        }),
      };

      const repo2 = new BaseRepository<TestRecord>(mockDb2 as never, makeMockTable());
      const result = await repo2.findById('1');
      expect(result).toEqual(record);
    });

    it('returns null when record not found', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      const repo = new BaseRepository<TestRecord>(mockDb as never, makeMockTable());
      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── findMany ────────────────────────────────────────────────

  describe('findMany', () => {
    it('returns all records when no where clause', async () => {
      const records = [
        { id: '1', name: 'a', createdAt: new Date().toISOString() },
        { id: '2', name: 'b', createdAt: new Date().toISOString() },
      ];
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(records),
            }),
          }),
        }),
      };

      const repo = new BaseRepository<TestRecord>(mockDb as never, makeMockTable());
      const result = await repo.findMany();
      expect(result).toHaveLength(2);
    });

    it('applies where clause when provided', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([{ id: '1', name: 'a', createdAt: '' }]),
              }),
            }),
          }),
        }),
      };

      const repo = new BaseRepository<TestRecord>(mockDb as never, makeMockTable());
      const result = await repo.findMany({ name: 'a' });
      expect(result).toHaveLength(1);
    });

    it('respects limit and offset', async () => {
      const offsetFn = vi.fn().mockResolvedValue([]);
      const limitFn = vi.fn().mockReturnValue({ offset: offsetFn });

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ limit: limitFn }),
        }),
      };

      const repo = new BaseRepository<TestRecord>(mockDb as never, makeMockTable());
      await repo.findMany(undefined, 10, 5);
      // The limit function should have been called
      expect(limitFn).toHaveBeenCalled();
    });
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    it('inserts and returns the created record', async () => {
      const record = { id: 'new-1', name: 'created', createdAt: new Date().toISOString() };
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([record]),
          }),
        }),
      };

      const repo = new BaseRepository<TestRecord>(mockDb as never, makeMockTable());
      const result = await repo.create({ name: 'created' });
      expect(result).toEqual(record);
    });
  });

  // ── update ──────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns the updated record', async () => {
      const record = { id: '1', name: 'updated', createdAt: new Date().toISOString() };
      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([record]),
            }),
          }),
        }),
      };

      const repo = new BaseRepository<TestRecord>(mockDb as never, makeMockTable());
      const result = await repo.update('1', { name: 'updated' });
      expect(result).toEqual(record);
    });

    it('returns null when record to update not found', async () => {
      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      const repo = new BaseRepository<TestRecord>(mockDb as never, makeMockTable());
      const result = await repo.update('nonexistent', { name: 'x' });
      expect(result).toBeNull();
    });
  });

  // ── delete ──────────────────────────────────────────────────

  describe('delete', () => {
    it('returns true when record is deleted', async () => {
      const mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: '1' }]),
          }),
        }),
      };

      const repo = new BaseRepository<TestRecord>(mockDb as never, makeMockTable());
      const result = await repo.delete('1');
      expect(result).toBe(true);
    });

    it('returns false when record not found', async () => {
      const mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      const repo = new BaseRepository<TestRecord>(mockDb as never, makeMockTable());
      const result = await repo.delete('nonexistent');
      expect(result).toBe(false);
    });
  });
});
