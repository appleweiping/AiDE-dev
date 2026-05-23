/**
 * a2a.ts — Agent-to-Agent (A2A) protocol server
 *
 * Implements a lightweight A2A server that allows external agents
 * (other AiDE instances, Claude Code, Gemini CLI, etc.) to discover
 * and invoke AiDE's agent capabilities over HTTP.
 *
 * Protocol: JSON-RPC 2.0 over HTTP POST /a2a
 * Discovery: GET /a2a/.well-known/agent.json
 *
 * Based on the Google A2A spec: https://google.github.io/A2A
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// A2A wire types
// ---------------------------------------------------------------------------

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  skills: Array<{ name: string; description: string }>;
  endpoint: string;
}

export interface A2ARequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params: unknown;
}

export interface A2AResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface A2ATask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: string;
  output?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// A2AServer
// ---------------------------------------------------------------------------

export interface A2AServerOptions {
  port?: number;
  host?: string;
  agentName?: string;
  agentDescription?: string;
  /** Called when a remote agent sends a task */
  onTask: (input: string, sessionId?: string) => Promise<string>;
}

export class A2AServer {
  private server: Server | null = null;
  private tasks = new Map<string, A2ATask>();
  private readonly options: Required<Omit<A2AServerOptions, 'onTask'>> & { onTask: A2AServerOptions['onTask'] };

  constructor(options: A2AServerOptions) {
    this.options = {
      port: options.port ?? 3748,
      host: options.host ?? '127.0.0.1',
      agentName: options.agentName ?? 'AiDE',
      agentDescription: options.agentDescription ?? 'AiDE coding agent — supports file editing, shell execution, web search, and more.',
      onTask: options.onTask,
    };
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.on('error', reject);
      this.server.listen(this.options.port, this.options.host, () => resolve());
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) { resolve(); return; }
      this.server.close(() => resolve());
    });
  }

  getEndpoint(): string {
    return `http://${this.options.host}:${this.options.port}/a2a`;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = req.url ?? '/';

    // Agent discovery card
    if (req.method === 'GET' && url === '/a2a/.well-known/agent.json') {
      const card: AgentCard = {
        name: this.options.agentName,
        description: this.options.agentDescription,
        version: '0.1.0',
        capabilities: ['text', 'file-edit', 'shell', 'web-search', 'git'],
        skills: [
          { name: 'code-review', description: 'Review code for issues' },
          { name: 'write-tests', description: 'Write unit tests' },
          { name: 'explain', description: 'Explain code' },
          { name: 'refactor', description: 'Refactor code' },
        ],
        endpoint: this.getEndpoint(),
      };
      res.writeHead(200);
      res.end(JSON.stringify(card, null, 2));
      return;
    }

    // Task status polling
    if (req.method === 'GET' && url.startsWith('/a2a/tasks/')) {
      const taskId = url.slice('/a2a/tasks/'.length);
      const task = this.tasks.get(taskId);
      if (!task) { res.writeHead(404); res.end(JSON.stringify({ error: 'Task not found' })); return; }
      res.writeHead(200);
      res.end(JSON.stringify(task));
      return;
    }

    // JSON-RPC endpoint
    if (req.method === 'POST' && url === '/a2a') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        let rpcReq: A2ARequest;
        try {
          rpcReq = JSON.parse(body) as A2ARequest;
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        const response = await this.handleRpc(rpcReq);
        res.writeHead(200);
        res.end(JSON.stringify(response));
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private async handleRpc(req: A2ARequest): Promise<A2AResponse> {
    try {
      switch (req.method) {
        case 'tasks/send': {
          const params = req.params as { message: { parts: Array<{ text?: string }> }; sessionId?: string };
          const text = params.message?.parts?.map((p) => p.text ?? '').join('') ?? '';
          if (!text) return this.error(req.id, -32602, 'Missing message text');

          const taskId = randomUUID();
          const task: A2ATask = {
            id: taskId,
            status: 'running',
            input: text,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          this.tasks.set(taskId, task);

          // Run async, don't await
          this.options.onTask(text, params.sessionId).then((output) => {
            task.status = 'completed';
            task.output = output;
            task.updatedAt = Date.now();
          }).catch((err: Error) => {
            task.status = 'failed';
            task.error = err.message;
            task.updatedAt = Date.now();
          });

          return { jsonrpc: '2.0', id: req.id, result: { id: taskId, status: 'running' } };
        }

        case 'tasks/get': {
          const { taskId } = req.params as { taskId: string };
          const task = this.tasks.get(taskId);
          if (!task) return this.error(req.id, -32001, 'Task not found');
          return { jsonrpc: '2.0', id: req.id, result: task };
        }

        case 'tasks/cancel': {
          const { taskId } = req.params as { taskId: string };
          const task = this.tasks.get(taskId);
          if (!task) return this.error(req.id, -32001, 'Task not found');
          task.status = 'failed';
          task.error = 'Cancelled by remote agent';
          task.updatedAt = Date.now();
          return { jsonrpc: '2.0', id: req.id, result: { cancelled: true } };
        }

        default:
          return this.error(req.id, -32601, `Method not found: ${req.method}`);
      }
    } catch (err) {
      return this.error(req.id, -32603, err instanceof Error ? err.message : String(err));
    }
  }

  private error(id: string | number, code: number, message: string): A2AResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}
