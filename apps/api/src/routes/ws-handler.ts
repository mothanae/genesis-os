import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';

interface WSConnection {
  socket: WebSocket;
  userId: string;
  projectId?: string;
  subscribedChannels: Set<string>;
  connectedAt: string;
}

const connections = new Map<string, WSConnection>();
const projectRooms = new Map<string, Set<string>>();

export async function wsHandler(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (socket, req) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const projectId = url.searchParams.get('projectId');

    if (!token) {
      socket.close(4001, 'Missing token');
      return;
    }

    // Stub auth: accept any non-empty token for dev
    const userId = `user_${token.slice(0, 8)}`;
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
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(msg, conn, connectionId, app);
      } catch {
        socket.send(JSON.stringify({ type: 'error', error: { code: 'INVALID_JSON', message: 'Invalid message format' } }));
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      connections.delete(connectionId);
      if (conn.projectId) {
        const room = projectRooms.get(conn.projectId);
        room?.delete(connectionId);
      }
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

    // Ping/pong
    socket.on('pong', () => {});
    const pingInterval = setInterval(() => {
      if (socket.readyState === socket.OPEN) socket.ping();
      else clearInterval(pingInterval);
    }, 30000);
  });

  // Subscribe to Redis events and forward to WebSocket clients
  await app.eventSubscriber.subscribe('genesis-1.graph.*' as never, async (event) => {
    broadcastToProject(event.projectId, event);
  });

  await app.eventSubscriber.subscribe('genesis-1.agent.execution.*' as never, async (event) => {
    broadcastToProject(event.projectId, event);
  });

  await app.eventSubscriber.subscribe('genesis-1.simulation.run.*' as never, async (event) => {
    broadcastToProject(event.projectId, event);
  });

  await app.eventSubscriber.subscribe('genesis-1.generation.*' as never, async (event) => {
    broadcastToProject(event.projectId, event);
  });
}

function handleClientMessage(
  msg: Record<string, unknown>,
  conn: WSConnection,
  connectionId: string,
  app: FastifyInstance,
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
      // Client mutated the graph — broadcast to other clients in the room
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
      // Broadcast cursor position for collaborative awareness
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
    case 'ping': {
      conn.socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;
    }
    default:
      conn.socket.send(JSON.stringify({ type: 'error', error: { code: 'UNKNOWN_TYPE', message: `Unknown message type: ${msg.type}` } }));
  }
}

function broadcastToProject(
  projectId: string | undefined,
  event: unknown,
  excludeConnectionId?: string,
): void {
  if (!projectId) return;
  const room = projectRooms.get(projectId);
  if (!room) return;

  const message = JSON.stringify(event);
  for (const connId of room) {
    if (connId === excludeConnectionId) continue;
    const conn = connections.get(connId);
    if (conn && conn.socket.readyState === conn.socket.OPEN) {
      conn.socket.send(message);
    }
  }
}
