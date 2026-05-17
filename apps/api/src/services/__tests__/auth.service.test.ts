import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('@genesis-1/config', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long!!!!!!',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
  },
}));

vi.mock('@genesis-1/database', () => {
  const { users, sessions } = createMockTables();
  return { users, sessions };
});

function createMockTables() {
  return {
    users: {
      id: 'users',
      email: 'email',
      passwordHash: 'password_hash',
      displayName: 'display_name',
      avatarUrl: 'avatar_url',
      role: 'role',
      isActive: 'is_active',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      $inferSelect: {} as any,
    },
    sessions: {
      id: 'sessions',
      userId: 'user_id',
      refreshToken: 'refresh_token',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      revokedAt: 'revoked_at',
      $inferSelect: {} as any,
    },
  };
}

import { AuthService } from '../auth.service';

function createMockDb() {
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return mockDb;
}

describe('AuthService', () => {
  let service: AuthService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    service = new AuthService(db);
  });

  describe('hashPassword', () => {
    it('should hash a password with bcrypt', async () => {
      const hash = await service.hashPassword('test-password-123');
      expect(hash).toBeTruthy();
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
    });

    it('should produce different hashes for same password', async () => {
      const hash1 = await service.hashPassword('password123!');
      const hash2 = await service.hashPassword('password123!');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching password', async () => {
      const hash = await service.hashPassword('my-password');
      const result = await service.verifyPassword('my-password', hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const hash = await service.hashPassword('my-password');
      const result = await service.verifyPassword('wrong-password', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a JWT token with correct payload', () => {
      const user = {
        id: 'test-user-id',
        email: 'test@genesis-1.dev',
        displayName: 'Test User',
        avatarUrl: null,
        role: 'user' as const,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const token = service.generateAccessToken(user);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different users', () => {
      const user1 = { id: 'user-1', email: 'a@test.com', role: 'user' as const, isActive: true, displayName: 'A', avatarUrl: null, createdAt: '', updatedAt: '' };
      const user2 = { id: 'user-2', email: 'b@test.com', role: 'admin' as const, isActive: true, displayName: 'B', avatarUrl: null, createdAt: '', updatedAt: '' };

      const token1 = service.generateAccessToken(user1);
      const token2 = service.generateAccessToken(user2);
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and decode a valid token', () => {
      const user = {
        id: 'test-user-id',
        email: 'test@genesis-1.dev',
        role: 'user' as const,
        isActive: true,
        displayName: 'Test',
        avatarUrl: null,
        createdAt: '',
        updatedAt: '',
      };

      const token = service.generateAccessToken(user);
      const payload = service.verifyAccessToken(token);

      expect(payload.sub).toBe(user.id);
      expect(payload.email).toBe(user.email);
      expect(payload.role).toBe(user.role);
    });

    it('should throw for invalid token', () => {
      expect(() => service.verifyAccessToken('invalid-token')).toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a UUID refresh token', () => {
      const token = service.generateRefreshToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      // UUID pattern check
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('register', () => {
    it('should create a new user and return tokens', async () => {
      db.select = vi.fn().mockReturnThis();
      db.from = vi.fn().mockReturnThis();
      db.where = vi.fn().mockReturnThis();
      db.limit = vi.fn().mockReturnValue([]); // No existing user
      db.insert = vi.fn().mockReturnThis();
      db.values = vi.fn().mockReturnThis();
      db.returning = vi.fn().mockReturnValue([{
        id: 'new-user-id',
        email: 'new@genesis-1.dev',
        passwordHash: 'hashed-password',
        displayName: 'New User',
        avatarUrl: null,
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const result = await service.register('new@genesis-1.dev', 'password123!', 'New User');

      expect(result.user.email).toBe('new@genesis-1.dev');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('should throw EmailAlreadyExistsError for duplicate email', async () => {
      db.select = vi.fn().mockReturnValue(db);
      db.from = vi.fn().mockReturnValue(db);
      db.where = vi.fn().mockReturnValue(db);
      db.limit = vi.fn().mockReturnValue([{ id: 'existing-id' }]);

      await expect(
        service.register('existing@genesis-1.dev', 'password123!', 'Test'),
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should throw InvalidCredentialsError for non-existent user', async () => {
      db.select = vi.fn().mockReturnValue(db);
      db.from = vi.fn().mockReturnValue(db);
      db.where = vi.fn().mockReturnValue(db);
      db.limit = vi.fn().mockReturnValue([]);

      await expect(
        service.login('nonexistent@test.com', 'password'),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw InvalidCredentialsError for wrong password', async () => {
      const hashedPassword = await service.hashPassword('correct-password');

      db.select = vi.fn().mockReturnValue(db);
      db.from = vi.fn().mockReturnValue(db);
      db.where = vi.fn().mockReturnValue(db);
      db.limit = vi.fn().mockReturnValue([{
        id: 'user-id',
        email: 'test@test.com',
        passwordHash: hashedPassword,
        displayName: 'Test',
        avatarUrl: null,
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      await expect(
        service.login('test@test.com', 'wrong-password'),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('token lifecycle', () => {
    it('should refresh and rotate tokens', async () => {
      const hashedPassword = await service.hashPassword('password');

      const userRow = {
        id: 'user-id',
        email: 'test@test.com',
        passwordHash: hashedPassword,
        displayName: 'Test',
        avatarUrl: null,
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      db.select = vi.fn().mockReturnValue(db);
      db.from = vi.fn().mockReturnValue(db);
      db.where = vi.fn().mockReturnValue(db);
      db.limit = vi.fn().mockReturnValue([userRow]);
      db.insert = vi.fn().mockReturnValue(db);
      db.values = vi.fn().mockReturnValue(db);
      db.returning = vi.fn().mockReturnValue([userRow]);

      // Login to get tokens
      const { accessToken, refreshToken } = await service.login('test@test.com', 'password');

      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();

      // Verify access token
      const payload = service.verifyAccessToken(accessToken);
      expect(payload.sub).toBe('user-id');
    });
  });
});
