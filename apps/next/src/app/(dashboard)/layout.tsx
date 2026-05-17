import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white p-4 flex flex-col gap-2">
        <h2 className="text-lg font-bold mb-4">Genesis-1</h2>
        <nav className="flex flex-col gap-1">
          <Link href="/dashboard" className="rounded px-3 py-2 hover:bg-gray-800">Dashboard</Link>
          <Link href="/dashboard/projects" className="rounded px-3 py-2 hover:bg-gray-800">Projects</Link>
          <Link href="/dashboard/settings" className="rounded px-3 py-2 hover:bg-gray-800">Settings</Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
