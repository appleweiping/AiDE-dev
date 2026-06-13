/**
 * daemon.ts — AiDE background daemon
 *
 * Runs the AiDE core engine as a persistent background process with a
 * WebSocket server instead of stdio. This allows:
 *   1. The Tauri desktop app to close without killing the agent
 *   2. Multiple clients (desktop, mobile, VS Code) to connect simultaneously
 *   3. Remote control from a phone via a relay server
 *
 * Usage:
 *   node dist/daemon.js [--port 7432] [--host 127.0.0.1] [--relay wss://relay.example.com]
 *
 * PID file: ~/.aide/daemon.pid
 * Log file: ~/.aide/daemon.log
 * Socket:   ws://127.0.0.1:7432
 */

import { createServer, type Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createWriteStream, type WriteStream } from 'node:fs';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { SessionManager } from './session/manager.js';
import { ApprovalManager } from './safety/approval.js';
import { McpManager } from './mcp/manager.js';
import { HooksManager } from './hooks/manager.js';
import { SharedContext } from './agent/sub-agent.js';
import { registerBuiltinTools, createDefaultTools } from './tools/index.js';
import { PROVIDER_PRESETS } from '@aide/shared';
import { providerRegistry } from './provider/registry.js';
import { Agent } from './agent.js';
import type { AgentConfig, ProviderConfig } from '@aide/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AIDE_DIR = join(homedir(), '.aide');
const PID_FILE = join(AIDE_DIR, 'daemon.pid');
const LOG_FILE = join(AIDE_DIR, 'daemon.log');
const SESSIONS_DIR = join(AIDE_DIR, 'sessions');

// Constant-time token comparison so the auth check can't be probed byte-by-byte
// via response timing. Length is compared first (timingSafeEqual requires equal
// lengths); a fixed-length token makes that disclosure harmless.
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

class DaemonLogger {
  private stream: WriteStream | null = null;

  async init(logFile: string): Promise<void> {
    await mkdir(join(logFile, '..'), { recursive: true });
    this.stream = createWriteStream(logFile, { flags: 'a' });
  }

  log(level: 'INFO' | 'WARN' | 'ERROR', msg: string): void {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
    process.stderr.write(line);
    this.stream?.write(line);
  }

  info(msg: string): void { this.log('INFO', msg); }
  warn(msg: string): void { this.log('WARN', msg); }
  error(msg: string): void { this.log('ERROR', msg); }
}

const logger = new DaemonLogger();

// ---------------------------------------------------------------------------
// Client connection
// ---------------------------------------------------------------------------

interface DaemonClient {
  id: string;
  ws: WebSocket;
  type: 'desktop' | 'mobile' | 'unknown';
  authenticated: boolean;
}

// ---------------------------------------------------------------------------
// AiDE Daemon
// ---------------------------------------------------------------------------

export interface DaemonOptions {
  port?: number;
  host?: string;
  /** Optional relay WebSocket URL for mobile remote control */
  relayUrl?: string;
  /** Auth token for relay and mobile clients */
  authToken?: string;
}

export class AideDaemon {
  private readonly port: number;
  private readonly host: string;
  private readonly relayUrl: string | null;
  private readonly authToken: string;

  private httpServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, DaemonClient>();
  private relayWs: WebSocket | null = null;

  private sessionManager: SessionManager;
  private approvalManager: ApprovalManager;
  private mcpManager: McpManager;
  private hooksManager: HooksManager;
  private sharedContext: SharedContext;
  private activeAgent: Agent | null = null;
  private activeSessionId: string | null = null;

  constructor(options: DaemonOptions = {}) {
    this.port = options.port ?? 7432;
    this.host = options.host ?? '127.0.0.1';
    this.relayUrl = options.relayUrl ?? null;
    this.authToken = options.authToken ?? randomUUID();

    this.sessionManager = new SessionManager(SESSIONS_DIR);
    this.approvalManager = new ApprovalManager('safe');
    this.mcpManager = new McpManager();
    this.hooksManager = new HooksManager();
    this.sharedContext = new SharedContext();

    this.approvalManager.on('approval_request', (req) => {
      this.broadcast('approval_request', req);
    });
  }

  async start(): Promise<void> {
    await mkdir(AIDE_DIR, { recursive: true });
    await logger.init(LOG_FILE);
    await this.sessionManager.init();
    registerBuiltinTools();

    // Write PID file
    await writeFile(PID_FILE, String(process.pid), 'utf-8');
    logger.info(`Daemon started. PID=${process.pid} port=${this.port}`);
    logger.info(`Auth token: ${this.authToken}`);

    // Start WebSocket server
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws, req) => {
      const clientId = randomUUID();
      const client: DaemonClient = {
        id: clientId,
        ws,
        type: 'unknown',
        authenticated: false,
      };
      this.clients.set(clientId, client);
      logger.info(`Client connected: ${clientId} from ${req.socket.remoteAddress}`);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          this.handleClientMessage(client, msg);
        } catch {
          ws.send(JSON.stringify({ event: 'error', data: { message: 'Invalid JSON' } }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info(`Client disconnected: ${clientId}`);
      });

      ws.on('error', (err) => {
        logger.error(`Client error ${clientId}: ${err.message}`);
        this.clients.delete(clientId);
      });

      // Send welcome
      ws.send(JSON.stringify({
        event: 'ready',
        data: { version: '0.1.0', daemonId: process.pid, requiresAuth: true },
      }));
    });

    await new Promise<void>((resolve) => {
      this.httpServer!.listen(this.port, this.host, () => {
        logger.info(`WebSocket server listening on ws://${this.host}:${this.port}`);
        resolve();
      });
    });

    // Connect to relay if configured
    if (this.relayUrl) {
      this.connectRelay();
    }

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.stop());
    process.on('SIGINT', () => this.stop());

    // Broadcast event: daemon ready
    this.broadcast('daemon.ready', { port: this.port, pid: process.pid });
  }

  private stopped = false;

  async stop(): Promise<void> {
    this.stopped = true;
    logger.info('Daemon stopping...');
    this.relayWs?.close();
    this.wss?.close();
    this.httpServer?.close();
    await unlink(PID_FILE).catch(() => {});
    process.exit(0);
  }

  // -------------------------------------------------------------------------
  // Client message handling
  // -------------------------------------------------------------------------

  private handleClientMessage(client: DaemonClient, msg: Record<string, unknown>): void {
    // Auth handshake
    if (msg.method === 'auth') {
      const token = String((msg.params as Record<string, unknown>)?.token ?? '');
      if (timingSafeEqualStr(token, this.authToken)) {
        client.authenticated = true;
        client.type = String((msg.params as Record<string, unknown>)?.clientType ?? 'unknown') as DaemonClient['type'];
        this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, result: { authenticated: true, clientId: client.id } });
        logger.info(`Client authenticated: ${client.id} type=${client.type}`);
      } else {
        this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, error: { code: -32001, message: 'Invalid auth token' } });
        client.ws.close();
      }
      return;
    }

    if (!client.authenticated) {
      this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, error: { code: -32001, message: 'Not authenticated' } });
      return;
    }

    // Delegate to the same dispatch logic as IpcServer
    this.dispatch(client, msg as JsonRpcMessage).catch((err) => {
      logger.error(`Dispatch error: ${err.message}`);
      this.sendToClient(client, {
        jsonrpc: '2.0',
        id: msg.id ?? null,
        error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
      });
    });
  }

  private async dispatch(client: DaemonClient, msg: JsonRpcMessage): Promise<void> {
    const params = (msg.params ?? {}) as Record<string, unknown>;

    switch (msg.method) {
      case 'session.list': {
        const sessions = await this.sessionManager.list();
        return this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, result: sessions });
      }

      case 'session.get': {
        const session = await this.sessionManager.get(String(params.id ?? ''));
        if (!session) return this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, error: { code: -32001, message: 'Session not found' } });
        return this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, result: session });
      }

      case 'agent.run': {
        const sessionId = String(params.sessionId ?? '');
        const message = String(params.message ?? '');
        const providerConfig = params.provider as ProviderConfig;
        const agentConfig = params.config as Partial<AgentConfig>;

        if (!message) return this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'message is required' } });

        const session = await this.sessionManager.get(sessionId);
        if (!session) return this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, error: { code: -32001, message: 'Session not found' } });

        const provider = providerRegistry.get(providerConfig);
        // Create a fresh tool registry per agent — never share the singleton
        const registry = createDefaultTools(session.workingDirectory);

        const config: AgentConfig = {
          provider: providerConfig,
          maxIterations: 50,
          thinkingEnabled: false,
          thinkingEffort: 'medium',
          permissionMode: 'safe',
          workingDirectory: session.workingDirectory,
          ...agentConfig,
        };

        const agent = await Agent.create(provider, registry, config, this.approvalManager, this.hooksManager);
        this.activeAgent = agent;
        this.activeSessionId = sessionId;

        agent.on('content', (delta) => this.broadcast('agent.content', { sessionId, delta }));
        agent.on('reasoning', (delta) => this.broadcast('agent.reasoning', { sessionId, delta }));
        agent.on('tool_start', (call) => this.broadcast('agent.tool_start', { sessionId, call }));
        agent.on('tool_end', (call, result, ms) => this.broadcast('agent.tool_end', { sessionId, call, result, ms }));
        agent.on('done', (reason, content) => {
          this.broadcast('agent.done', { sessionId, reason, content });
          this.activeAgent = null;
          this.activeSessionId = null;
          // Push notification via ntfy if configured
          this.sendPushNotification(`AiDE task complete: ${content.slice(0, 100)}`);
        });

        this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, result: { started: true } });
        agent.run(message, sessionId).catch((err) => {
          this.broadcast('agent.error', { sessionId, error: err.message });
        });
        return;
      }

      case 'agent.cancel': {
        this.activeAgent?.cancel();
        return this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, result: { cancelled: true } });
      }

      case 'approval.respond': {
        const { id: approvalId, approved, remember } = params as { id: string; approved: boolean; remember?: boolean };
        this.approvalManager.respond({ id: approvalId, approved, remember });
        return this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, result: { ok: true } });
      }

      case 'ping':
        return this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, result: { pong: true } });

      case 'daemon.status': {
        return this.sendToClient(client, {
          jsonrpc: '2.0', id: msg.id,
          result: {
            pid: process.pid,
            port: this.port,
            uptime: process.uptime(),
            clients: this.clients.size,
            activeSession: this.activeSessionId,
            relayConnected: this.relayWs?.readyState === WebSocket.OPEN,
          },
        });
      }

      case 'daemon.stop': {
        this.sendToClient(client, { jsonrpc: '2.0', id: msg.id, result: { stopping: true } });
        setTimeout(() => this.stop(), 500);
        return;
      }

      default:
        return this.sendToClient(client, {
          jsonrpc: '2.0', id: msg.id,
          error: { code: -32601, message: `Method not found: ${msg.method}` },
        });
    }
  }

  // -------------------------------------------------------------------------
  // Relay connection (for mobile remote control)
  // -------------------------------------------------------------------------

  private connectRelay(): void {
    if (!this.relayUrl) return;
    logger.info(`Connecting to relay: ${this.relayUrl}`);

    this.relayWs = new WebSocket(`${this.relayUrl}?token=${this.authToken}&role=desktop`);

    this.relayWs.on('open', () => {
      logger.info('Relay connected');
      this.broadcast('relay.connected', {});
    });

    this.relayWs.on('message', (data) => {
      // Messages from relay are forwarded from mobile clients
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        // Create a virtual client for the relay
        const relayClient: DaemonClient = {
          id: 'relay',
          ws: this.relayWs!,
          type: 'mobile',
          authenticated: true,
        };
        this.dispatch(relayClient, msg as JsonRpcMessage).catch((err) => {
          logger.error(`Relay dispatch error: ${err.message}`);
        });
      } catch { /* ignore */ }
    });

    this.relayWs.on('close', () => {
      if (this.stopped) return;
      logger.warn('Relay disconnected, reconnecting in 5s...');
      this.broadcast('relay.disconnected', {});
      setTimeout(() => this.connectRelay(), 5000);
    });

    this.relayWs.on('error', (err) => {
      logger.error(`Relay error: ${err.message}`);
    });
  }

  // -------------------------------------------------------------------------
  // Push notifications via ntfy.sh
  // -------------------------------------------------------------------------

  private ntfyTopic: string | null = null;

  setNtfyTopic(topic: string): void {
    this.ntfyTopic = topic;
  }

  private sendPushNotification(message: string): void {
    if (!this.ntfyTopic) return;
    fetch(`https://ntfy.sh/${this.ntfyTopic}`, {
      method: 'POST',
      body: message,
      headers: { 'Title': 'AiDE', 'Priority': 'default', 'Tags': 'robot' },
    }).catch(() => { /* non-fatal */ });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private broadcast(event: string, data: unknown): void {
    const msg = JSON.stringify({ event, data });
    for (const client of this.clients.values()) {
      if (client.authenticated && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
    // Also forward to relay
    if (this.relayWs?.readyState === WebSocket.OPEN) {
      this.relayWs.send(msg);
    }
  }

  private sendToClient(client: DaemonClient, msg: unknown): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(msg));
    }
  }
}

// ---------------------------------------------------------------------------
// Daemon management utilities
// ---------------------------------------------------------------------------

export async function isDaemonRunning(): Promise<boolean> {
  try {
    const pid = parseInt(await readFile(PID_FILE, 'utf-8'), 10);
    if (isNaN(pid)) return false;
    process.kill(pid, 0); // throws if process doesn't exist
    return true;
  } catch {
    return false;
  }
}

export async function getDaemonPid(): Promise<number | null> {
  try {
    const pid = parseInt(await readFile(PID_FILE, 'utf-8'), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export async function stopDaemon(): Promise<boolean> {
  const pid = await getDaemonPid();
  if (!pid) return false;
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: unknown;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function startDaemon(options: DaemonOptions = {}): Promise<void> {
  const daemon = new AideDaemon(options);
  await daemon.start();
  // Keep process alive
  process.stdin.resume();
}
