import { hash, compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { DatabaseClient } from '@genesis-1/database';
import { users, sessions } from '@genesis-1/database';
import { env } from '@genesis-1/config';
import { eq, and, isNull } from 'drizzle-orm';
import type { JwtPayload, User } from '@genesis-1/shared';

const BCRYPT_ROUNDS = 12;
const ALGORITHM = 'HS256' as const;

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    role: row.role as User['role'],
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class AuthService {
  constructor(private db: DatabaseClient) {}

  async hashPassword(password: string): Promise<string> {
    return hash(password, BCRYPT_ROUNDS);
  }

  async verifyPassword(password: string, hashed: string): Promise<boolean> {
    return compare(password, hashed);
  }

  generateAccessToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
    };
    return jwt.sign(payload, env.JWT_SECRET, { algorithm: ALGORITHM });
  }

  generateRefreshToken(): string {
    return crypto.randomUUID();
  }

  verifyAccessToken(token: string): JwtPayload {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [ALGORITHM],
    });
    return payload as JwtPayload;
  }

  async register(email: string, password: string, displayName: string) {
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      throw new EmailAlreadyExistsError();
    }

    const passwordHash = await this.hashPassword(password);
    const [row] = await this.db
      .insert(users)
      .values({ email, passwordHash, displayName })
      .returning();

    const user = toUser(row);
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    await this.createSession(user.id, refreshToken);

    return { user, accessToken, refreshToken };
  }

  async login(email: string, password: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (result.length === 0) {
      throw new InvalidCredentialsError();
    }

    const row = result[0];
    if (!row.isActive) {
      throw new UserBlockedError();
    }

    const valid = await this.verifyPassword(password, row.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const user = toUser(row);
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    await this.createSession(user.id, refreshToken);

    return { user, accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    const result = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshToken, refreshToken),
          isNull(sessions.revokedAt),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      throw new InvalidRefreshTokenError();
    }

    const session = result[0];
    if (new Date(session.expiresAt) < new Date()) {
      throw new InvalidRefreshTokenError();
    }

    const userResult = await this.db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (userResult.length === 0 || !userResult[0].isActive) {
      throw new UserBlockedError();
    }

    const user = toUser(userResult[0]);
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken();

    await this.revokeSession(session.id);
    await this.createSession(user.id, newRefreshToken);

    return { user, accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async getMe(userId: string): Promise<User> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) {
      throw new UserNotFoundError();
    }
    return toUser(result[0]);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() } as never)
      .where(eq(sessions.refreshToken, refreshToken));
  }

  private async createSession(userId: string, refreshToken: string) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.db.insert(sessions).values({
      userId,
      refreshToken,
      expiresAt,
    } as never);
  }

  private async revokeSession(sessionId: string) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() } as never)
      .where(eq(sessions.id, sessionId));
  }
}

// Domain errors
class EmailAlreadyExistsError extends Error {
  statusCode = 409;
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyExistsError';
  }
}

class InvalidCredentialsError extends Error {
  statusCode = 401;
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

class InvalidRefreshTokenError extends Error {
  statusCode = 401;
  constructor() {
    super('Invalid or expired refresh token');
    this.name = 'InvalidRefreshTokenError';
  }
}

class UserBlockedError extends Error {
  statusCode = 403;
  constructor() {
    super('Account is blocked');
    this.name = 'UserBlockedError';
  }
}

class UserNotFoundError extends Error {
  statusCode = 404;
  constructor() {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
}
