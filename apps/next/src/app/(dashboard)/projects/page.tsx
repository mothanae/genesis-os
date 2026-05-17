import Link from 'next/link';

export default function ProjectsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Link href="/dashboard/projects/new" className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          New Project
        </Link>
      </div>
      <p className="text-gray-500">No projects yet. Create your first project to get started.</p>
    </div>
  );
}
