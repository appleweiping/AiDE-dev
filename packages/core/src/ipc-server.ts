/**
 * ipc-server.ts
 *
 * JSON-RPC 2.0 server over stdio.
 * The Tauri shell spawns this process and communicates via stdin/stdout.
 *
 * Protocol:
 *   - Requests:  newline-delimited JSON-RPC 2.0 objects on stdin
 *   - Responses: newline-delimited JSON-RPC 2.0 objects on stdout
 *   - Events:    newline-delimited JSON objects with { event, data } on stdout
 *
 * All CoreMethod requests are handled here.
 * CoreEvent notifications are pushed to stdout as they occur.
 */

import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import type {
  AgentConfig,
  ProviderConfig,
  ApprovalResponse,
  Message,
} from '@aide/shared';
import { PROVIDER_PRESETS } from '@aide/shared';
import { Agent } from './agent.js';
import { providerRegistry } from './provider/registry.js';
import type { ProviderMessage } from './provider/types.js';
import { toolRegistry } from './tools/registry.js';
import { registerBuiltinTools } from './tools/index.js';
import { ApprovalManager } from './safety/approval.js';
import { SessionManager } from './session/manager.js';

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface CoreEvent {
  event: string;
  data: unknown;
}

// ---------------------------------------------------------------------------
// IPC Server
// ---------------------------------------------------------------------------

export class IpcServer {
  private sessionManager: SessionManager;
  private approvalManager: ApprovalManager;
  private activeAgent: Agent | null = null;
  private activeSessionId: string | null = null;

  constructor(sessionsDir: string) {
    this.sessionManager = new SessionManager(sessionsDir);
    this.approvalManager = new ApprovalManager('safe');

    // Forward approval requests to the UI
    this.approvalManager.on('approval_request', (request) => {
      this.sendEvent('approval_request', request);
    });
  }

  async start(): Promise<void> {
    await this.sessionManager.init();
    registerBuiltinTools();

    const rl = createInterface({
      input: process.stdin,
      output: undefined,
      terminal: false,
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      this.handleLine(trimmed);
    });

    rl.on('close', () => {
      process.exit(0);
    });

    // Signal readiness
    this.sendEvent('ready', { version: '0.1.0' });
  }

  // -------------------------------------------------------------------------
  // Line handler
  // -------------------------------------------------------------------------

  private handleLine(line: string): void {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch {
      this.sendError(null, -32700, 'Parse error');
      return;
    }

    if (request.jsonrpc !== '2.0' || !request.method) {
      this.sendError(request.id ?? null, -32600, 'Invalid Request');
      return;
    }

    this.dispatch(request).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.sendError(request.id, -32603, `Internal error: ${message}`);
    });
  }

  // -------------------------------------------------------------------------
  // Method dispatcher
  // -------------------------------------------------------------------------

  private async dispatch(request: JsonRpcRequest): Promise<void> {
    const params = (request.params ?? {}) as Record<string, unknown>;

    switch (request.method) {
      // --- Provider methods ---
      case 'provider.list':
        return this.sendResult(request.id, PROVIDER_PRESETS);

      case 'provider.getPreset': {
        const id = String(params.id ?? '');
        const preset = providerRegistry.getPreset(id);
        if (!preset) return this.sendError(request.id, -32602, `Unknown provider: ${id}`);
        return this.sendResult(request.id, preset);
      }

      // --- Session methods ---
      case 'session.list': {
        const sessions = await this.sessionManager.list();
        return this.sendResult(request.id, sessions);
      }

      case 'session.create': {
        const session = await this.sessionManager.create({
          title: params.title as string | undefined,
          workingDirectory: String(params.workingDirectory ?? process.cwd()),
          providerId: String(params.providerId ?? 'deepseek'),
          model: String(params.model ?? 'deepseek-chat'),
        });
        return this.sendResult(request.id, session);
      }

      case 'session.get': {
        const id = String(params.id ?? '');
        const session = await this.sessionManager.get(id);
        if (!session) return this.sendError(request.id, -32602, `Session not found: ${id}`);
        return this.sendResult(request.id, session);
      }

      case 'session.delete': {
        const id = String(params.id ?? '');
        const ok = await this.sessionManager.delete(id);
        return this.sendResult(request.id, { deleted: ok });
      }

      case 'session.rename': {
        const id = String(params.id ?? '');
        const title = String(params.title ?? '');
        const ok = await this.sessionManager.rename(id, title);
        return this.sendResult(request.id, { renamed: ok });
      }

      case 'session.clearMessages': {
        const id = String(params.id ?? '');
        const ok = await this.sessionManager.clearMessages(id);
        return this.sendResult(request.id, { cleared: ok });
      }

      // --- Agent methods ---
      case 'agent.run': {
        const sessionId = String(params.sessionId ?? '');
        const userMessage = String(params.message ?? '');
        const providerConfig = params.provider as ProviderConfig;
        const agentConfig = params.config as AgentConfig;

        if (!sessionId || !userMessage || !providerConfig) {
          return this.sendError(request.id, -32602, 'sessionId, message, and provider are required');
        }

        // Load session
        const session = await this.sessionManager.get(sessionId);
        if (!session) {
          return this.sendError(request.id, -32602, `Session not found: ${sessionId}`);
        }

        // Cancel any running agent
        if (this.activeAgent) {
          this.activeAgent.cancel();
          this.activeAgent = null;
        }

        // Create provider and agent
        const provider = providerRegistry.get(providerConfig);
        const agent = new Agent(
          provider,
          toolRegistry,
          agentConfig ?? {
            provider: providerConfig,
            maxIterations: 50,
            thinkingEnabled: false,
            thinkingEffort: 'medium',
            permissionMode: 'safe',
            workingDirectory: session.workingDirectory,
          },
          this.approvalManager,
        );

        // Restore message history
        if (session.messages.length > 0) {
          agent.restoreMessages(
            session.messages.map(messageToProviderMessage),
          );
        }

        this.activeAgent = agent;
        this.activeSessionId = sessionId;

        // Wire up streaming events
        agent.on('content', (delta) => this.sendEvent('agent.content', { sessionId, delta }));
        agent.on('reasoning', (delta) => this.sendEvent('agent.reasoning', { sessionId, delta }));
        agent.on('thinking', (iteration) => this.sendEvent('agent.thinking', { sessionId, iteration }));
        agent.on('tool_start', (call) => this.sendEvent('agent.tool_start', { sessionId, call }));
        agent.on('tool_end', (call, result, elapsedMs) =>
          this.sendEvent('agent.tool_end', { sessionId, call, result, elapsedMs }),
        );
        agent.on('done', (reason, content) => {
          this.sendEvent('agent.done', { sessionId, reason, content });
          this.activeAgent = null;
          this.activeSessionId = null;
        });
        agent.on('error', (err) => {
          this.sendEvent('agent.error', { sessionId, error: err.message });
        });

        // Acknowledge immediately, then run async
        this.sendResult(request.id, { started: true, sessionId });

        // Run agent and persist result
        agent.run(userMessage).then(async (reply) => {
          // Persist updated messages back to session
          const updatedMessages = agent.getMessages();
          const updatedSession = await this.sessionManager.get(sessionId);
          if (updatedSession) {
            updatedSession.messages = updatedMessages.map(providerMessageToMessage);
            await this.sessionManager.update(updatedSession);
          }
        }).catch(() => {
          // Error already emitted via agent.on('error')
        });

        return;
      }

      case 'agent.cancel': {
        if (this.activeAgent) {
          this.activeAgent.cancel();
          this.activeAgent = null;
        }
        return this.sendResult(request.id, { cancelled: true });
      }

      case 'agent.compact': {
        if (!this.activeAgent) {
          return this.sendError(request.id, -32603, 'No active agent');
        }
        const keepRecent = typeof params.keepRecent === 'number' ? params.keepRecent : 12;
        const summary = this.activeAgent.compactContext(keepRecent);
        return this.sendResult(request.id, { summary });
      }

      // --- Approval methods ---
      case 'approval.respond': {
        const response = params as ApprovalResponse;
        const toolName = String(params.toolName ?? '');
        if (toolName) {
          this.approvalManager.respondWithToolName(response, toolName);
        } else {
          this.approvalManager.respond(response);
        }
        return this.sendResult(request.id, { ok: true });
      }

      case 'approval.setMode': {
        const mode = String(params.mode ?? 'safe') as 'safe' | 'trusted' | 'locked';
        this.approvalManager.setMode(mode);
        return this.sendResult(request.id, { mode });
      }

      case 'approval.getMode': {
        return this.sendResult(request.id, { mode: this.approvalManager.getMode() });
      }

      // --- Tool methods ---
      case 'tools.list': {
        return this.sendResult(request.id, toolRegistry.list());
      }

      case 'tools.execute': {
        const name = String(params.name ?? '');
        const args = (params.args ?? {}) as Record<string, unknown>;
        if (!name) return this.sendError(request.id, -32602, 'name is required');
        const result = await toolRegistry.execute(name, args);
        return this.sendResult(request.id, result);
      }

      default:
        return this.sendError(request.id, -32601, `Method not found: ${request.method}`);
    }
  }

  // -------------------------------------------------------------------------
  // Output helpers
  // -------------------------------------------------------------------------

  private sendResult(id: string | number | null, result: unknown): void {
    const response: JsonRpcResponse = { jsonrpc: '2.0', id: id ?? null, result };
    this.writeLine(JSON.stringify(response));
  }

  private sendError(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown,
  ): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    };
    this.writeLine(JSON.stringify(response));
  }

  private sendEvent(event: string, data: unknown): void {
    const notification: CoreEvent = { event, data };
    this.writeLine(JSON.stringify(notification));
  }

  private writeLine(line: string): void {
    process.stdout.write(line + '\n');
  }
}

// ---------------------------------------------------------------------------
// Message conversion helpers
// ---------------------------------------------------------------------------

function messageToProviderMessage(msg: Message): ProviderMessage {
  if (msg.role === 'tool') {
    // Tool results are stored in toolResults array in shared Message type
    // but we need to reconstruct the wire format
    const result = msg.toolResults?.[0];
    return {
      role: 'tool',
      content: result?.content ?? msg.content,
      tool_call_id: result?.callId ?? '',
    };
  }

  if (msg.role === 'assistant') {
    const toolCalls = msg.toolCalls?.map((tc) => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
    }));
    return {
      role: 'assistant',
      content: msg.content || null,
      ...(msg.reasoning ? { reasoning_content: msg.reasoning } : {}),
      ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    };
  }

  return { role: msg.role as 'system' | 'user', content: msg.content };
}

function providerMessageToMessage(msg: ProviderMessage): Message {
  const now = Date.now();

  if (msg.role === 'tool') {
    return {
      role: 'tool',
      content: msg.content,
      toolResults: [{ callId: msg.tool_call_id, content: msg.content, isError: false }],
      timestamp: now,
    };
  }

  if (msg.role === 'assistant') {
    const toolCalls = msg.tool_calls?.map((tc) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch {}
      return { id: tc.id, name: tc.function.name, arguments: args };
    });
    return {
      role: 'assistant',
      content: msg.content ?? '',
      ...(msg.reasoning_content ? { reasoning: msg.reasoning_content } : {}),
      ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
      timestamp: now,
    };
  }

  return { role: msg.role, content: msg.content, timestamp: now };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function startIpcServer(sessionsDir?: string): Promise<void> {
  const dir = sessionsDir ?? resolve(process.env.AIDE_SESSIONS_DIR ?? './sessions');
  const server = new IpcServer(dir);
  await server.start();
}
