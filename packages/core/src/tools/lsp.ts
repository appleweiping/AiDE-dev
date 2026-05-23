/**
 * lsp.ts — Language Server Protocol tool
 *
 * Spawns an LSP server for the project and exposes code intelligence
 * (hover, go-to-definition, find-references, diagnostics) as agent tools.
 *
 * Supports any LSP server: typescript-language-server, pyright, rust-analyzer, etc.
 * Falls back gracefully if no LSP server is configured.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ToolDefinition } from '@aide/shared';
import type { ToolResult } from './registry.js';

// ---------------------------------------------------------------------------
// LSP wire types (minimal subset of LSP 3.17)
// ---------------------------------------------------------------------------

interface LspRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown;
}

interface LspResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface LspNotification {
  jsonrpc: '2.0';
  method: string;
  params: unknown;
}

interface Position { line: number; character: number; }
interface Range { start: Position; end: Position; }
interface Location { uri: string; range: Range; }

// ---------------------------------------------------------------------------
// LSP server presets by file extension
// ---------------------------------------------------------------------------

const LSP_PRESETS: Record<string, { command: string; args: string[] }> = {
  '.ts': { command: 'typescript-language-server', args: ['--stdio'] },
  '.tsx': { command: 'typescript-language-server', args: ['--stdio'] },
  '.js': { command: 'typescript-language-server', args: ['--stdio'] },
  '.jsx': { command: 'typescript-language-server', args: ['--stdio'] },
  '.py': { command: 'pyright-langserver', args: ['--stdio'] },
  '.rs': { command: 'rust-analyzer', args: [] },
  '.go': { command: 'gopls', args: [] },
  '.java': { command: 'jdtls', args: [] },
  '.c': { command: 'clangd', args: [] },
  '.cpp': { command: 'clangd', args: [] },
};

// ---------------------------------------------------------------------------
// LspClient
// ---------------------------------------------------------------------------

export class LspClient {
  private proc: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: LspResponse) => void; reject: (e: Error) => void }>();
  private buffer = '';
  private initialized = false;
  private workspaceUri: string;

  constructor(private readonly workspaceDir: string) {
    this.workspaceUri = `file://${resolve(workspaceDir).replace(/\\/g, '/')}`;
  }

  async start(command: string, args: string[]): Promise<void> {
    this.proc = spawn(command, args, {
      cwd: this.workspaceDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout?.on('data', (chunk: Buffer) => this.handleData(chunk));
    this.proc.on('error', () => { this.proc = null; });
    this.proc.on('exit', () => { this.proc = null; });

    await this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.request('initialize', {
      processId: process.pid,
      rootUri: this.workspaceUri,
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['plaintext'] },
          definition: {},
          references: {},
          publishDiagnostics: {},
        },
      },
      initializationOptions: {},
    });
    this.notify('initialized', {});
    this.initialized = true;
  }

  async openFile(filePath: string): Promise<void> {
    const content = await readFile(filePath, 'utf-8');
    const uri = `file://${resolve(filePath).replace(/\\/g, '/')}`;
    const ext = extname(filePath);
    const languageId = ext === '.ts' || ext === '.tsx' ? 'typescript'
      : ext === '.js' || ext === '.jsx' ? 'javascript'
      : ext === '.py' ? 'python'
      : ext === '.rs' ? 'rust'
      : ext === '.go' ? 'go'
      : 'plaintext';

    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version: 1, text: content },
    });
  }

  async hover(filePath: string, line: number, character: number): Promise<string> {
    if (!this.initialized || !this.proc) return 'LSP server not running.';
    await this.openFile(filePath);
    const uri = `file://${resolve(filePath).replace(/\\/g, '/')}`;
    const result = await this.request('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    }) as { contents?: { value?: string } | string } | null;

    if (!result) return 'No hover information.';
    if (typeof result.contents === 'string') return result.contents;
    return result.contents?.value ?? 'No hover information.';
  }

  async definition(filePath: string, line: number, character: number): Promise<Location[]> {
    if (!this.initialized || !this.proc) return [];
    await this.openFile(filePath);
    const uri = `file://${resolve(filePath).replace(/\\/g, '/')}`;
    const result = await this.request('textDocument/definition', {
      textDocument: { uri },
      position: { line, character },
    });
    if (!result) return [];
    return Array.isArray(result) ? result as Location[] : [result as Location];
  }

  async references(filePath: string, line: number, character: number): Promise<Location[]> {
    if (!this.initialized || !this.proc) return [];
    await this.openFile(filePath);
    const uri = `file://${resolve(filePath).replace(/\\/g, '/')}`;
    const result = await this.request('textDocument/references', {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration: true },
    });
    return (result as Location[] | null) ?? [];
  }

  stop(): void {
    if (this.proc) {
      this.notify('exit', {});
      this.proc.kill();
      this.proc = null;
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.proc?.stdin) {
        reject(new Error('LSP server not running'));
        return;
      }
      const id = this.nextId++;
      this.pending.set(id, { resolve: resolve as (r: LspResponse) => void, reject });
      const msg: LspRequest = { jsonrpc: '2.0', id, method, params };
      const body = JSON.stringify(msg);
      this.proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`LSP request timed out: ${method}`));
        }
      }, 10_000);
    });
  }

  private notify(method: string, params: unknown): void {
    if (!this.proc?.stdin) return;
    const msg: LspNotification = { jsonrpc: '2.0', method, params };
    const body = JSON.stringify(msg);
    this.proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString();
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const header = this.buffer.slice(0, headerEnd);
      const lenMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lenMatch) { this.buffer = this.buffer.slice(headerEnd + 4); continue; }
      const len = parseInt(lenMatch[1], 10);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + len) break;
      const body = this.buffer.slice(bodyStart, bodyStart + len);
      this.buffer = this.buffer.slice(bodyStart + len);
      try {
        const msg = JSON.parse(body) as LspResponse;
        if (msg.id !== undefined) {
          const pending = this.pending.get(msg.id);
          if (pending) {
            this.pending.delete(msg.id);
            if (msg.error) pending.reject(new Error(msg.error.message));
            else pending.resolve(msg);
          }
        }
      } catch { /* ignore parse errors */ }
    }
  }
}

// ---------------------------------------------------------------------------
// LSP tool factories
// ---------------------------------------------------------------------------

export function createLspHoverTool(client: LspClient): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'lsp_hover',
    description: 'Get hover information (type, documentation) for a symbol at a specific position in a file.',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Absolute path to the file' },
        line: { type: 'number', description: '0-based line number' },
        character: { type: 'number', description: '0-based character offset' },
      },
      required: ['file', 'line', 'character'],
    },
    async execute(args) {
      try {
        const info = await client.hover(args.file as string, args.line as number, args.character as number);
        return { output: info, isError: false };
      } catch (err) {
        return { output: `LSP error: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createLspDefinitionTool(client: LspClient): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'lsp_definition',
    description: 'Jump to the definition of a symbol at a specific position in a file.',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Absolute path to the file' },
        line: { type: 'number', description: '0-based line number' },
        character: { type: 'number', description: '0-based character offset' },
      },
      required: ['file', 'line', 'character'],
    },
    async execute(args) {
      try {
        const locs = await client.definition(args.file as string, args.line as number, args.character as number);
        if (locs.length === 0) return { output: 'No definition found.', isError: false };
        const lines = locs.map((l) => `${l.uri.replace('file://', '')}:${l.range.start.line + 1}:${l.range.start.character + 1}`);
        return { output: lines.join('\n'), isError: false };
      } catch (err) {
        return { output: `LSP error: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export function createLspReferencesTool(client: LspClient): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'lsp_references',
    description: 'Find all references to a symbol at a specific position in a file.',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Absolute path to the file' },
        line: { type: 'number', description: '0-based line number' },
        character: { type: 'number', description: '0-based character offset' },
      },
      required: ['file', 'line', 'character'],
    },
    async execute(args) {
      try {
        const locs = await client.references(args.file as string, args.line as number, args.character as number);
        if (locs.length === 0) return { output: 'No references found.', isError: false };
        const lines = locs.map((l) => `${l.uri.replace('file://', '')}:${l.range.start.line + 1}:${l.range.start.character + 1}`);
        return { output: `${locs.length} reference(s):\n${lines.join('\n')}`, isError: false };
      } catch (err) {
        return { output: `LSP error: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}

export { LSP_PRESETS };
