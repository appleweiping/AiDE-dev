/**
 * AiDE Relay Server
 *
 * A lightweight WebSocket relay that bridges the desktop daemon and mobile app.
 * Both sides connect to this server; the relay forwards messages between them.
 *
 * Architecture:
 *   Desktop daemon  ──ws──▶  Relay  ◀──ws──  Mobile app
 *
 * Auth: token-based. The desktop daemon generates a token on startup.
 * The mobile app scans a QR code from the desktop to get the relay URL + token.
 *
 * Self-hostable. Default port: 7433.
 * Can also use Tailscale for zero-infrastructure LAN access.
 *
 * Usage:
 *   node dist/index.js [--port 7433] [--host 0.0.0.0]
 */

import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelayClient {
  id: string;
  ws: WebSocket;
  role: 'desktop' | 'mobile' | 'unknown';
  token: string;
  connectedAt: number;
}

interface RelayRoom {
  token: string;
  desktop: RelayClient | null;
  mobiles: Set<RelayClient>;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Relay Server
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '7433', 10);
// Secure default: bind loopback only. The relay forwards a control channel to
// the desktop daemon (which executes agent tool calls), so a default-open
// 0.0.0.0 bind put that channel on every LAN interface. Opt into LAN exposure
// explicitly via HOST=0.0.0.0 (or front it with Tailscale, as the header notes).
const HOST = process.env.HOST ?? '127.0.0.1';
// Reject guessable tokens used as room keys — the token is the only thing
// gating who can join a desktop's room.
const MIN_TOKEN_LEN = 24;
const MAX_ROOMS = 100;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const rooms = new Map<string, RelayRoom>();
const clients = new Map<string, RelayClient>();

function getOrCreateRoom(token: string): RelayRoom {
  if (!rooms.has(token)) {
    if (rooms.size >= MAX_ROOMS) {
      // Evict oldest room
      const oldest = [...rooms.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) rooms.delete(oldest[0]);
    }
    rooms.set(token, { token, desktop: null, mobiles: new Set(), createdAt: Date.now() });
  }
  return rooms.get(token)!;
}

function cleanupStaleRooms(): void {
  const now = Date.now();
  for (const [token, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS && !room.desktop && room.mobiles.size === 0) {
      rooms.delete(token);
    }
  }
}

setInterval(cleanupStaleRooms, 60_000);

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size, clients: clients.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const token = url.searchParams.get('token') ?? '';
  const role = (url.searchParams.get('role') ?? 'unknown') as RelayClient['role'];

  if (!token) {
    ws.close(4001, 'Missing token');
    return;
  }
  if (token.length < MIN_TOKEN_LEN) {
    ws.close(4003, 'Token too short');
    return;
  }

  const clientId = randomUUID();
  const client: RelayClient = { id: clientId, ws, role, token, connectedAt: Date.now() };
  clients.set(clientId, client);

  const room = getOrCreateRoom(token);

  if (role === 'desktop') {
    // Do NOT silently evict a live desktop: a second 'desktop' connection on a
    // known token would otherwise hijack the channel to the daemon. Only take
    // over a slot whose previous socket is already gone (legitimate reconnect).
    if (room.desktop && room.desktop.ws.readyState === WebSocket.OPEN) {
      clients.delete(clientId);
      ws.close(4004, 'Desktop already connected for this room');
      return;
    }
    room.desktop = client;
    console.log(`[RELAY] Desktop connected: ${clientId}`);

    // Notify all mobile clients that desktop is online
    for (const mobile of room.mobiles) {
      if (mobile.ws.readyState === WebSocket.OPEN) {
        mobile.ws.send(JSON.stringify({ event: 'desktop.connected', data: {} }));
      }
    }
  } else {
    room.mobiles.add(client);
    console.log(`[RELAY] Mobile connected: ${clientId}`);

    // Notify desktop that a mobile client connected
    if (room.desktop?.ws.readyState === WebSocket.OPEN) {
      room.desktop.ws.send(JSON.stringify({ event: 'mobile.connected', data: { clientId } }));
    }
  }

  // Send welcome
  ws.send(JSON.stringify({
    event: 'relay.connected',
    data: {
      clientId,
      role,
      desktopOnline: !!room.desktop && room.desktop.ws.readyState === WebSocket.OPEN,
      mobileCount: room.mobiles.size,
    },
  }));

  ws.on('message', (data) => {
    const room = getOrCreateRoom(token);

    if (role === 'desktop') {
      // Desktop → broadcast to all mobiles
      for (const mobile of room.mobiles) {
        if (mobile.ws.readyState === WebSocket.OPEN) {
          mobile.ws.send(data);
        }
      }
    } else {
      // Mobile → forward to desktop
      if (room.desktop?.ws.readyState === WebSocket.OPEN) {
        room.desktop.ws.send(data);
      } else {
        ws.send(JSON.stringify({ event: 'error', data: { message: 'Desktop not connected' } }));
      }
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    const room = rooms.get(token);
    if (!room) return;

    if (role === 'desktop') {
      room.desktop = null;
      console.log(`[RELAY] Desktop disconnected: ${clientId}`);
      for (const mobile of room.mobiles) {
        if (mobile.ws.readyState === WebSocket.OPEN) {
          mobile.ws.send(JSON.stringify({ event: 'desktop.disconnected', data: {} }));
        }
      }
    } else {
      room.mobiles.delete(client);
      console.log(`[RELAY] Mobile disconnected: ${clientId}`);
      if (room.desktop?.ws.readyState === WebSocket.OPEN) {
        room.desktop.ws.send(JSON.stringify({ event: 'mobile.disconnected', data: { clientId } }));
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`[RELAY] Client error ${clientId}: ${err.message}`);
    clients.delete(clientId);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[RELAY] AiDE Relay Server running on ws://${HOST}:${PORT}`);
  console.log(`[RELAY] Health check: http://${HOST}:${PORT}/health`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') {
    console.warn(`[RELAY] WARNING: bound to ${HOST} (non-loopback) — the daemon control channel is reachable off-host. Ensure the token is strong and the network is trusted (e.g. Tailscale).`);
  }
});
