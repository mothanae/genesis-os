'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface ExecutionLoopStatus {
  topology: { valid: boolean; errors: number; warnings: number };
  plan: { taskCount: number };
  execution: Array<{ type: string; status: string }>;
  generation: { files: number; lines: number };
  deployment: { modules: number };
  evolution: { insights: number; fixes: number };
}

export function useExecutionLoop(projectId: string) {
  const [status, setStatus] = useState<ExecutionLoopStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient<ExecutionLoopStatus>(`/api/v1/projects/${projectId}/execute-loop`, {
        method: 'POST',
      });
      setStatus(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return { status, loading, error, execute };
}
