import { useAuthStore } from '@/stores/auth.store';

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

async function refreshAccessToken(): Promise<string | null> {
  const store = useAuthStore.getState();
  if (!store.refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: store.refreshToken }),
    });

    if (!res.ok) {
      store.logout();
      return null;
    }

    const json = await res.json();
    if (!json.success) return null;

    const { user, accessToken, refreshToken } = json.data;
    localStorage.setItem('genesis_token', accessToken);
    localStorage.setItem('genesis_refresh', refreshToken);

    useAuthStore.setState({
      user,
      token: accessToken,
      refreshToken,
      isAuthenticated: true,
    });

    return accessToken;
  } catch {
    return null;
  }
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const { body, timeout = 30000, ...init } = options;

  const token = useAuthStore.getState().token;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  async function doFetch(authToken: string | null): Promise<Response> {
    return fetch(`${API_URL}${endpoint}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  }

  try {
    let res = await doFetch(token);

    if (res.status === 401 && token) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        res = await doFetch(newToken);
      }
    }

    const data = await res.json();

    if (!res.ok) {
      // Show toast for common errors
      try {
        const { useToastStore } = await import('@/stores/toast.store');
        const message = data?.error ?? `Request failed (${res.status})`;
        const toastType = res.status >= 500 ? 'error' : res.status === 403 ? 'warning' : 'error';
        useToastStore.getState().addToast({ type: toastType, message });
      } catch { /* toast is best-effort */ }

      throw new ApiClientError(
        res.status,
        data?.code ?? 'UNKNOWN',
        data?.error ?? `HTTP ${res.status}`,
        data?.details,
      );
    }

    return data.data as T;
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    // Network error
    try {
      const { useToastStore } = await import('@/stores/toast.store');
      useToastStore.getState().addToast({ type: 'error', message: 'Network error — check your connection' });
    } catch { /* toast is best-effort */ }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
