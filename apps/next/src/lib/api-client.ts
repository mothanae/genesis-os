const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ApiClientOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeout?: number;
}

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiClient<T = unknown>(endpoint: string, options: ApiClientOptions = {}): Promise<T> {
  const { body, timeout = 30000, ...init } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new ApiClientError(
        res.status,
        data?.error?.code ?? 'UNKNOWN',
        data?.error?.message ?? `HTTP ${res.status}`,
        data?.error?.details,
      );
    }

    return data.data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
