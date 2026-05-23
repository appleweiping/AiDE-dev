// LLM Provider types

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  options?: Record<string, unknown>;
}

export interface ProviderPreset {
  id: string;
  name: string;
  nameZh: string;
  baseUrl: string;
  models: ModelInfo[];
  supportsToolUse: boolean;
  supportsThinking: boolean;
  supportsVision: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  supportsToolUse: boolean;
  supportsThinking: boolean;
}

// Streaming types

export type StreamChunk =
  | { type: 'content'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
  | { type: 'tool_call_end'; id: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'done'; stopReason: string };

// Tool types

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  content: string;
  isError: boolean;
}

export type JsonSchema = Record<string, unknown>;

// Message types

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  reasoning?: string;
  timestamp: number;
}

// Session types

export interface Session {
  id: string;
  title: string;
  workingDirectory: string;
  providerId: string;
  model: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// Agent config

export interface AgentConfig {
  provider: ProviderConfig;
  maxIterations: number;
  thinkingEnabled: boolean;
  thinkingEffort: 'low' | 'medium' | 'high';
  permissionMode: PermissionMode;
  workingDirectory: string;
}

export type PermissionMode = 'safe' | 'trusted' | 'locked';

// Approval types

export interface ApprovalRequest {
  id: string;
  toolName: string;
  description: string;
  command?: string;
  filePath?: string;
  timestamp: number;
}

export type ApprovalResponse = {
  id: string;
  approved: boolean;
  remember?: boolean;
};
