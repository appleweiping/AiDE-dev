// IPC protocol between Tauri shell and Node.js core sidecar
// Transport: JSON-RPC over stdio

export interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

export interface RpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface RpcEvent {
  jsonrpc: '2.0';
  method: string;
  params: unknown;
}

// Request methods (Desktop -> Core)

export type CoreMethod =
  | 'agent.run'
  | 'agent.cancel'
  | 'session.list'
  | 'session.get'
  | 'session.resume'
  | 'session.delete'
  | 'config.get'
  | 'config.set'
  | 'config.testProvider'
  | 'approval.respond';

export interface AgentRunParams {
  message: string;
  sessionId?: string;
  workingDirectory: string;
}

export interface AgentCancelParams {
  sessionId: string;
}

export interface ConfigSetParams {
  provider?: Partial<import('./types.js').ProviderConfig>;
  agent?: Partial<import('./types.js').AgentConfig>;
}

export interface TestProviderParams {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ApprovalRespondParams {
  id: string;
  approved: boolean;
  remember?: boolean;
}

// Event methods (Core -> Desktop)

export type CoreEvent =
  | 'stream.content'
  | 'stream.reasoning'
  | 'stream.toolStart'
  | 'stream.toolEnd'
  | 'stream.usage'
  | 'agent.done'
  | 'agent.error'
  | 'approval.request';

export interface StreamContentEvent {
  delta: string;
}

export interface StreamReasoningEvent {
  delta: string;
}

export interface StreamToolStartEvent {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

export interface StreamToolEndEvent {
  callId: string;
  name: string;
  result: string;
  isError: boolean;
  durationMs: number;
}

export interface StreamUsageEvent {
  inputTokens: number;
  outputTokens: number;
}

export interface AgentDoneEvent {
  content: string;
  sessionId: string;
}

export interface AgentErrorEvent {
  message: string;
  code?: string;
}

export interface ApprovalRequestEvent {
  id: string;
  toolName: string;
  description: string;
  command?: string;
  filePath?: string;
}
