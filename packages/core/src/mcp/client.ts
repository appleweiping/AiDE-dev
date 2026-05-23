import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class McpClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private buffer = '';
  private tools: McpTool[] = [];

  constructor(private config: McpServerConfig) {
    super();
  }

  get name(): string {
    return this.config.name;
  }

  get availableTools(): McpTool[] {
    return this.tools;
  }

  async connect(): Promise<void> {
    this.process = spawn(this.config.command, this.config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.config.env },
    });

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      this.emit('stderr', chunk.toString());
    });

    this.process.on('exit', (code) => {
      this.emit('exit', code);
      this.process = null;
    });

    await this.initialize();
    await this.discoverTools();
  }

  private async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'aide', version: '0.1.0' },
    });

    await this.notify('notifications/initialized', {});
  }

  private async discoverTools(): Promise<void> {
    const result = await this.request('tools/list', {}) as { tools: McpTool[] };
    this.tools = result.tools || [];
    this.emit('toolsDiscovered', this.tools);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.request('tools/call', { name, arguments: args }) as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };

    const textParts = (result.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '');

    return textParts.join('\n');
  }

  async listResources(): Promise<unknown[]> {
    const result = await this.request('resources/list', {}) as { resources: unknown[] };
    return result.resources || [];
  }

  async readResource(uri: string): Promise<string> {
    const result = await this.request('resources/read', { uri }) as {
      contents: Array<{ text?: string }>;
    };
    return (result.contents || []).map((c) => c.text || '').join('\n');
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    const id = ++this.requestId;
    const message: JsonRpcMessage = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send(message);

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  private async notify(method: string, params: unknown): Promise<void> {
    const message: JsonRpcMessage = { jsonrpc: '2.0', method, params };
    this.send(message);
  }

  private send(message: JsonRpcMessage): void {
    if (!this.process?.stdin?.writable) {
      throw new Error('MCP server not connected');
    }
    const json = JSON.stringify(message);
    this.process.stdin.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
  }

  private processBuffer(): void {
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = this.buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1]);
      const contentStart = headerEnd + 4;

      if (this.buffer.length < contentStart + contentLength) break;

      const content = this.buffer.slice(contentStart, contentStart + contentLength);
      this.buffer = this.buffer.slice(contentStart + contentLength);

      try {
        const message = JSON.parse(content) as JsonRpcMessage;
        this.handleMessage(message);
      } catch {
        this.emit('parseError', content);
      }
    }
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (message.id !== undefined && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id)!;
      this.pending.delete(message.id);

      if (message.error) {
        reject(new Error(`MCP error: ${message.error.message}`));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      this.emit('notification', { method: message.method, params: message.params });
    }
  }

  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    for (const { reject } of this.pending.values()) {
      reject(new Error('MCP client disconnected'));
    }
    this.pending.clear();
  }

  get connected(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
