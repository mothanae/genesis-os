import Link from 'next/link';

export default function DashboardHome() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/projects" className="rounded-lg border p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">Projects</h2>
          <p className="text-gray-600">Manage your software architecture projects</p>
        </Link>
        <Link href="/dashboard/projects/new" className="rounded-lg border p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">Builder</h2>
          <p className="text-gray-600">Create and visualize new architectures</p>
        </Link>
        <Link href="/dashboard/settings" className="rounded-lg border p-6 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-2">Settings</h2>
          <p className="text-gray-600">Account and workspace settings</p>
        </Link>
      </div>
    </div>
  );
}
