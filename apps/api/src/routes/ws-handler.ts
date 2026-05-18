import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { SemanticInference } from '@genesis-1/graph-engine';

interface WSConnection {
  socket: WebSocket;
  userId: string;
  projectId?: string;
  subscribedChannels: Set<string>;
  connectedAt: string;
}

const connections = new Map<string, WSConnection>();
const projectRooms = new Map<string, Set<string>>();
const WS_BROADCAST_CHANNEL = 'genesis-1.ws.broadcast';
const MAX_CONNECTIONS_PER_USER = 5;
const WS_CONN_COUNTER_TTL = 60; // seconds — refreshed on ping

/** Unique instance ID for this server process (avoids cross-instance echo). */
const INSTANCE_ID = `srv_${crypto.randomUUID().slice(0, 8)}`;

export async function wsHandler(app: FastifyInstance): Promise<void> {
  // ── Redis cross-instance broadcast subscription ──────────
  // Messages published by other server instances are forwarded to local connections.
  await app.eventSubscriber.subscribe(`${WS_BROADCAST_CHANNEL}:*` as never, async (event) => {
    const { projectId, payload, excludeConnectionId, sourceInstance } = (event as unknown as {
      projectId?: string; payload?: string; excludeConnectionId?: string; sourceInstance?: string;
    });
    // Skip if this instance published it
    if (!projectId || !payload || sourceInstance === INSTANCE_ID) return;
    deliverToRoom(projectId, payload, excludeConnectionId);
  });

  app.get('/ws', { websocket: true }, async (socket, req) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const projectId = url.searchParams.get('projectId');

    if (!token) {
      socket.close(4001, 'Missing token');
      return;
    }

    // Verify JWT token
    let userId: string;
    try {
      const payload = app.authService.verifyAccessToken(token);
      userId = payload.sub;
    } catch {
      socket.close(4003, 'Invalid or expired token');
      return;
    }

    // Redis-backed global connection limit per user (fail-open on Redis error)
    const connKey = `ws:conn:${userId}`;
    try {
      const count = await app.redis.incr(connKey);
      await app.redis.expire(connKey, WS_CONN_COUNTER_TTL);
      if (count > MAX_CONNECTIONS_PER_USER) {
        await app.redis.decr(connKey);
        socket.close(4004, 'Too many connections');
        return;
      }
    } catch {
      // Redis unavailable — allow connection (fail-open)
    }

    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const conn: WSConnection = {
      socket,
      userId,
      projectId: projectId ?? undefined,
      subscribedChannels: new Set(),
      connectedAt: new Date().toISOString(),
    };

    connections.set(connectionId, conn);

    if (projectId) {
      let room = projectRooms.get(projectId);
      if (!room) {
        room = new Set();
        projectRooms.set(projectId, room);
      }
      room.add(connectionId);
    }

    // Send acknowledgment
    socket.send(JSON.stringify({
      type: 'ack',
      connectionId,
      userId,
      timestamp: new Date().toISOString(),
    }));

    // Handle messages from client
    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(msg, conn, connectionId);
      } catch {
        socket.send(JSON.stringify({ type: 'error', error: { code: 'INVALID_JSON', message: 'Invalid message format' } }));
      }
    });

    function handleClientMessage(
      msg: Record<string, unknown>,
      conn: WSConnection,
      connectionId: string,
    ): void {
      switch (msg.type) {
        case 'subscribe': {
          const channel = msg.channel as string;
          if (channel) {
            conn.subscribedChannels.add(channel);
            conn.socket.send(JSON.stringify({ type: 'subscribed', channel }));
          }
          break;
        }
        case 'unsubscribe': {
          const channel = msg.channel as string;
          conn.subscribedChannels.delete(channel);
          conn.socket.send(JSON.stringify({ type: 'unsubscribed', channel }));
          break;
        }
        case 'graph_mutation': {
          const payload = msg.payload as Record<string, unknown>;
          if (conn.projectId) {
            broadcastToProject(conn.projectId, {
              type: 'graph_mutation',
              source: connectionId,
              payload,
              timestamp: new Date().toISOString(),
            }, connectionId);
          }
          break;
        }
        case 'cursor_move': {
          if (conn.projectId) {
            broadcastToProject(conn.projectId, {
              type: 'cursor_move',
              source: connectionId,
              userId: conn.userId,
              payload: msg.payload as Record<string, unknown>,
              timestamp: new Date().toISOString(),
            }, connectionId);
          }
          break;
        }
        case 'infer_connection': {
          const payload = msg.payload as { sourceType?: string; targetType?: string; edgeType?: string };
          if (payload.sourceType && payload.targetType) {
            const inference = new SemanticInference();
            const results = inference.inferForConnection(
              payload.sourceType,
              payload.targetType,
              payload.edgeType ?? 'depends_on',
            );
            conn.socket.send(JSON.stringify({
              type: 'inference_result',
              sourceType: payload.sourceType,
              targetType: payload.targetType,
              edgeType: payload.edgeType,
              suggestions: results,
              timestamp: new Date().toISOString(),
            }));
          }
          break;
        }
        case 'ping': {
          conn.socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
        }
        default:
          conn.socket.send(JSON.stringify({ type: 'error', error: { code: 'UNKNOWN_TYPE', message: `Unknown message type: ${msg.type}` } }));
      }
    }

    // Handle disconnect
    socket.on('close', () => {
      connections.delete(connectionId);
      if (conn.projectId) {
        const room = projectRooms.get(conn.projectId);
        room?.delete(connectionId);
        if (room?.size === 0) projectRooms.delete(conn.projectId);
      }

      // Decrement global connection counter (best-effort)
      app.redis.decr(`ws:conn:${userId}`).catch(() => {});

      app.eventPublisher.publish('genesis-1.ws.client.disconnected', {
        id: crypto.randomUUID(),
        type: 'genesis-1.ws.client.disconnected' as never,
        source: 'ws-server',
        correlationId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        userId,
        payload: { connectionId },
        metadata: { version: 1, priority: 'low' },
      });
    });

    // Ping/pong — refreshes connection count TTL
    socket.on('pong', () => {
      app.redis.expire(`ws:conn:${userId}`, WS_CONN_COUNTER_TTL).catch(() => {});
    });
    const pingInterval = setInterval(() => {
      if (socket.readyState === socket.OPEN) socket.ping();
      else clearInterval(pingInterval);
    }, 30000);
  });

  // ── Event Subscriptions ──────────────────────────────────

  await app.eventSubscriber.subscribe('genesis-1.graph.*' as never, async (event) => {
    broadcastToProject((event as { projectId?: string }).projectId, event);
  });

  await app.eventSubscriber.subscribe('genesis-1.agent.execution.*' as never, async (event) => {
    broadcastToProject((event as { projectId?: string }).projectId, event);
  });

  await app.eventSubscriber.subscribe('genesis-1.simulation.run.*' as never, async (event) => {
    broadcastToProject((event as { projectId?: string }).projectId, event);
  });

  await app.eventSubscriber.subscribe('genesis-1.generation.*' as never, async (event) => {
    broadcastToProject((event as { projectId?: string }).projectId, event);
  });

  // ── Broadcast Helpers (closed over `app`) ────────────────

  /**
   * Broadcast an event to all clients in a project room.
   * Delivers locally AND publishes to Redis for cross-instance propagation.
   */
  function broadcastToProject(projectId: string | undefined, event: unknown, excludeConnectionId?: string): void {
    if (!projectId) return;
    const message = JSON.stringify(event);

    // Deliver locally
    deliverToRoom(projectId, message, excludeConnectionId);

    // Publish to Redis for other server instances (fire-and-forget)
    app.eventPublisher.publish(`${WS_BROADCAST_CHANNEL}:${projectId}` as never, {
      projectId,
      payload: message,
      excludeConnectionId,
      sourceInstance: INSTANCE_ID,
    } as never).catch(() => {});
  }
}

// ── Local Room Delivery ─────────────────────────────────────

/** Deliver a message to local connections in a room, excluding one connection. */
function deliverToRoom(projectId: string, message: string, excludeConnectionId?: string): void {
  const room = projectRooms.get(projectId);
  if (!room) return;

  for (const connId of room) {
    if (connId === excludeConnectionId) continue;
    const conn = connections.get(connId);
    if (conn && conn.socket.readyState === conn.socket.OPEN) {
      conn.socket.send(message);
    }
  }
}
