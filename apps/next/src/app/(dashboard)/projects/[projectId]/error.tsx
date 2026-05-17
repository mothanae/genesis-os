'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Project error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-24 p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900">Failed to Load Project</h2>
        <p className="text-sm text-gray-500">{error.message || 'The project could not be loaded.'}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Retry
          </button>
          <Link
            href="/dashboard/projects"
            className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
