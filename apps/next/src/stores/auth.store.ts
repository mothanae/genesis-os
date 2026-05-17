'use client';

import type { User } from '@genesis-1/shared';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
};

// Stub: zustand-like store. Replace with zustand if needed.
let state = { ...initialState };
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export const authStore = {
  getState: () => state,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  login: (user: User, token: string) => {
    state = { user, token, isAuthenticated: true };
    notify();
  },
  logout: () => {
    state = { ...initialState };
    notify();
  },
};
