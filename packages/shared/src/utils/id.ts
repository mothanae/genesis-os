import { nanoid } from 'nanoid';

export function generateId(prefix?: string, size = 16): string {
  const id = nanoid(size);
  return prefix ? `${prefix}_${id}` : id;
}

export function generateUlid(): string {
  // ULID-compatible: 26 character timestamp + random
  const time = Date.now().toString(36).padStart(10, '0');
  const rand = nanoid(16);
  return `${time}${rand}`;
}
