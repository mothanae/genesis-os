'use client';

import { useEffect, useRef, useCallback } from 'react';

interface WSMessage {
  type: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  projectId?: string;
  onEvent?: (event: WSMessage) => void;
  onGraphMutation?: (payload: Record<string, unknown>) => void;
  onExecutionProgress?: (payload: Record<string, unknown>) => void;
}

export function useWebSocket({ projectId, onEvent, onGraphMutation, onExecutionProgress }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('genesis_token') ?? '' : '';
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';
    const url = new URL(wsUrl);
    url.searchParams.set('token', token);
    if (projectId) url.searchParams.set('projectId', projectId);

    const socket = new WebSocket(url.toString());

    socket.onopen = () => {
      // Subscribe to project channels
      if (projectId) {
        socket.send(JSON.stringify({ type: 'subscribe', channel: `project:${projectId}:graph:*` }));
        socket.send(JSON.stringify({ type: 'subscribe', channel: `project:${projectId}:agent:*` }));
        socket.send(JSON.stringify({ type: 'subscribe', channel: `project:${projectId}:simulation:*` }));
        socket.send(JSON.stringify({ type: 'subscribe', channel: `project:${projectId}:generation:*` }));
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        onEvent?.(msg);

        if (msg.type?.includes('graph.')) {
          onGraphMutation?.(msg as Record<string, unknown>);
        }
        if (msg.type?.includes('execution.') || msg.type?.includes('generation.')) {
          onExecutionProgress?.(msg as Record<string, unknown>);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    socket.onclose = () => {
      // Reconnect after 3s
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    wsRef.current = socket;
  }, [projectId, onEvent, onGraphMutation, onExecutionProgress]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { send };
}
