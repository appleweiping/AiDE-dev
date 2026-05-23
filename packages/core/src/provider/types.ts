import type { ProviderConfig, StreamChunk, ToolDefinition, Message } from '@aide/shared';

/**
 * Core interface every LLM provider must implement.
 * All Chinese LLMs expose an OpenAI-compatible REST API, so most providers
 * will extend OpenAICompatProvider rather than implement this directly.
 */
export interface LLMProvider {
  /** Provider identifier, e.g. "deepseek", "qwen" */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /**
   * Non-streaming completion. Returns the full assistant message once done.
   * Prefer `stream` for interactive use; use `complete` for batch/background work.
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Streaming completion. Yields typed chunks as they arrive from the API.
   * The caller is responsible for accumulating content/tool_calls.
   */
  stream(request: CompletionRequest, signal?: AbortSignal): AsyncGenerator<StreamChunk>;

  /** Whether this provider/model supports tool use (function calling). */
  supportsToolUse(): boolean;

  /** Whether this provider/model supports extended thinking / reasoning. */
  supportsThinking(): boolean;

  /** Whether this provider/model supports image inputs. */
  supportsVision(): boolean;
}

// ---------------------------------------------------------------------------
// Request / response shapes used by LLMProvider
// ---------------------------------------------------------------------------

export interface CompletionRequest {
  messages: ProviderMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  /** Enable extended thinking / chain-of-thought reasoning */
  thinking?: boolean;
  thinkingEffort?: 'low' | 'medium' | 'high';
  /** Extra provider-specific parameters forwarded verbatim to the API */
  extra?: Record<string, unknown>;
}

export interface CompletionResponse {
  content: string;
  reasoning: string | null;
  toolCalls: ProviderToolCall[];
  usage: TokenUsage;
  stopReason: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// ---------------------------------------------------------------------------
// Wire-level message types (OpenAI format)
// ---------------------------------------------------------------------------

export type ProviderMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; reasoning_content?: string | null; tool_calls?: ProviderToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

export interface ProviderToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ---------------------------------------------------------------------------
// Factory function type
// ---------------------------------------------------------------------------

export type ProviderFactory = (config: ProviderConfig) => LLMProvider;
