import crypto from 'node:crypto';
import type { DatabaseClient } from '@genesis-1/database';
import { apiKeys } from '@genesis-1/database';
import { eq, and, isNull } from 'drizzle-orm';

const KEY_PREFIX = 'genesis_';
const KEY_LENGTH = 32;

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function generateApiKeyValue(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const randomPart = crypto.randomBytes(KEY_LENGTH).toString('hex');
  const rawKey = `${KEY_PREFIX}${randomPart}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12);
  return { rawKey, keyHash, keyPrefix };
}

export class ApiKeyService {
  constructor(private db: DatabaseClient) {}

  async createKey(
    userId: string,
    name: string,
    scopes: string[] = [],
    expiresInDays?: number,
  ): Promise<{ info: ApiKeyInfo; rawKey: string }> {
    // Limit to 10 keys per user
    const existing = await this.db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.lastUsedAt) ? undefined : undefined))
      .limit(10);
    if (existing.length >= 10) {
      throw new ApiKeyLimitError();
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKeyValue();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const [row] = await this.db
      .insert(apiKeys)
      .values({
        userId,
        name,
        keyHash,
        keyPrefix,
        scopes,
        expiresAt,
      })
      .returning();

    return {
      info: {
        id: row!.id,
        name: row!.name,
        keyPrefix: row!.keyPrefix,
        scopes: row!.scopes,
        lastUsedAt: row!.lastUsedAt?.toISOString() ?? null,
        expiresAt: row!.expiresAt?.toISOString() ?? null,
        createdAt: row!.createdAt.toISOString(),
      },
      rawKey,
    };
  }

  async listKeys(userId: string): Promise<ApiKeyInfo[]> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(apiKeys.createdAt);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async revokeKey(keyId: string, userId: string): Promise<void> {
    const result = await this.db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      throw new ApiKeyNotFoundError();
    }

    await this.db.delete(apiKeys).where(eq(apiKeys.id, keyId));
  }

  async verifyApiKey(rawKey: string): Promise<{ userId: string; scopes: string[] } | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (result.length === 0) return null;

    const key = result[0]!;
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return null;

    // Update lastUsedAt
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() } as never)
      .where(eq(apiKeys.id, key.id));

    return { userId: key.userId, scopes: key.scopes };
  }
}

export class ApiKeyLimitError extends Error {
  statusCode = 400;
  constructor() {
    super('Maximum of 10 API keys reached');
    this.name = 'ApiKeyLimitError';
  }
}

export class ApiKeyNotFoundError extends Error {
  statusCode = 404;
  constructor() {
    super('API key not found');
    this.name = 'ApiKeyNotFoundError';
  }
}
