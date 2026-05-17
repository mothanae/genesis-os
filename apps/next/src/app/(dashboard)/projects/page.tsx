'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient<{ data: Project[] }>('/api/v1/projects')
      .then((r) => setProjects(r.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Link
          href="/dashboard/projects/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 text-sm font-medium"
        >
          New Project
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading projects...
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          Failed to load projects: {error}
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <div className="text-4xl mb-3">📂</div>
          <p className="text-gray-500 mb-4">No projects yet. Create your first project to get started.</p>
          <Link
            href="/dashboard/projects/new"
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 text-sm"
          >
            Create Project
          </Link>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="block border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
