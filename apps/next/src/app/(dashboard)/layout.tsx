'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, logout } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-900 text-white p-4 flex flex-col gap-2">
        <h2 className="text-lg font-bold mb-4">Genesis-1</h2>
        <nav className="flex flex-col gap-1 flex-1">
          <Link href="/dashboard" className="rounded px-3 py-2 hover:bg-gray-800">Dashboard</Link>
          <Link href="/dashboard/projects" className="rounded px-3 py-2 hover:bg-gray-800">Projects</Link>
          <Link href="/dashboard/settings" className="rounded px-3 py-2 hover:bg-gray-800">Settings</Link>
        </nav>
        <button
          onClick={() => logout()}
          className="rounded px-3 py-2 text-left hover:bg-gray-800 text-gray-400"
        >
          Logout
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
