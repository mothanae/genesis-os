'use client';

import { create } from 'zustand';
import type { User } from '@genesis-1/shared';
import { apiClient } from '@/lib/api-client';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  refresh: () => Promise<void>;
}

function parseJwtPayload(token: string): { exp?: number } | null {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

const TOKEN_KEY = 'genesis_token';
const REFRESH_KEY = 'genesis_refresh';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const data = await apiClient<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);

    set({
      user: data.user,
      token: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  register: async (email, password, displayName) => {
    const data = await apiClient<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
    });

    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);

    set({
      user: data.user,
      token: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    const rf = get().refreshToken;
    if (rf) {
      try {
        await apiClient('/api/v1/auth/logout', {
          method: 'POST',
          body: { refreshToken: rf },
        });
      } catch {
        // Best-effort
      }
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);

    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  restoreSession: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const rf = localStorage.getItem(REFRESH_KEY);

    if (!token) {
      set({ isLoading: false });
      return;
    }

    const payload = parseJwtPayload(token);
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      set({ isLoading: false });
      return;
    }

    set({ token, refreshToken: rf, isAuthenticated: true, isLoading: true });

    // Fetch user profile to restore full session
    try {
      const user = await apiClient<User>('/api/v1/auth/me', { method: 'GET' });
      set({ user, isLoading: false });
    } catch {
      // Token may be invalid — clear session
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isLoading: false });
    }
  },

  refresh: async () => {
    const rf = get().refreshToken;
    if (!rf) throw new Error('No refresh token');

    const data = await apiClient<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: rf },
    });

    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);

    set({
      user: data.user,
      token: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
    });
  },
}));
