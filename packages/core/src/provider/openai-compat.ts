import type { ProviderConfig, StreamChunk, ToolDefinition } from '@aide/shared';
import type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderMessage,
  ProviderToolCall,
  TokenUsage,
} from './types.js';

/**
 * OpenAI-compatible provider base class.
 *
 * All major Chinese LLMs (DeepSeek, Qwen, GLM, Kimi, Doubao, MiniMax) expose
 * an OpenAI-compatible /chat/completions endpoint. This class handles:
 *   - SSE stream parsing
 *   - Incremental tool_call accumulation (index / function / arguments deltas)
 *   - reasoning_content deltas (DeepSeek R1, QwQ)
 *   - finish_reason handling
 *   - Retry with exponential back-off on 429 / 5xx
 */
export abstract class OpenAICompatProvider implements LLMProvider {
  abstract readonly id: string;
  abstract readonly name: string;

  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected model: string;
  protected readonly requestTimeoutMs: number;
  protected readonly maxRetries: number;

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.requestTimeoutMs = (config.options?.requestTimeoutMs as number | undefined) ?? 120_000;
    this.maxRetries = (config.options?.maxRetries as number | undefined) ?? 3;
  }

  // Subclasses override these to declare capabilities
  supportsToolUse(): boolean { return true; }
  supportsThinking(): boolean { return false; }
  supportsVision(): boolean { return false; }

  // -------------------------------------------------------------------------
  // Non-streaming complete
  // -------------------------------------------------------------------------

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const body = this.buildRequestBody(request, false);

    const res = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${this.name} API error ${res.status}: ${text.slice(0, 500)}`);
    }

    const data = JSON.parse(text) as OpenAIResponse;
    const choice = data.choices?.[0];
    if (!choice) throw new Error(`${this.name}: no choices in response`);

    return {
      content: choice.message?.content ?? '',
      reasoning: choice.message?.reasoning_content ?? null,
      toolCalls: choice.message?.tool_calls ?? [],
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      stopReason: choice.finish_reason ?? 'stop',
    };
  }

  // -------------------------------------------------------------------------
  // Streaming complete — yields typed StreamChunk values
  // -------------------------------------------------------------------------

  async *stream(request: CompletionRequest, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const body = this.buildRequestBody(request, true);

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${this.name} API error ${res.status}: ${text.slice(0, 500)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error(`${this.name}: no response body`);

    const decoder = new TextDecoder();
    let buffer = '';

    // Accumulator for incremental tool_call deltas
    // OpenAI streams tool_calls as: [{index, id?, type?, function: {name?, arguments?}}]
    const toolCallAccum: Map<number, AccumToolCall> = new Map();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') {
            // Flush any incomplete tool calls
            for (const [, tc] of toolCallAccum) {
              yield { type: 'tool_call_end', id: tc.id };
            }
            return;
          }

          let chunk: OpenAIStreamChunk;
          try {
            chunk = JSON.parse(payload) as OpenAIStreamChunk;
          } catch {
            continue;
          }

          // Usage chunk (some providers send this as a separate event)
          if (chunk.usage) {
            yield {
              type: 'usage',
              inputTokens: chunk.usage.prompt_tokens ?? 0,
              outputTokens: chunk.usage.completion_tokens ?? 0,
            };
          }

          const choice = chunk.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;
          if (!delta) continue;

          // --- reasoning_content delta (DeepSeek R1, QwQ) ---
          if (delta.reasoning_content) {
            yield { type: 'reasoning', delta: delta.reasoning_content };
          }

          // --- content delta ---
          if (delta.content) {
            yield { type: 'content', delta: delta.content };
          }

          // --- tool_call deltas ---
          if (delta.tool_calls) {
            for (const tcDelta of delta.tool_calls) {
              const idx = tcDelta.index ?? 0;

              if (!toolCallAccum.has(idx)) {
                // First delta for this tool call — must have id and name
                const id = tcDelta.id ?? `call_${idx}_${Date.now()}`;
                const name = tcDelta.function?.name ?? '';
                toolCallAccum.set(idx, { id, name, arguments: '' });
                yield { type: 'tool_call_start', id, name };
              }

              const accum = toolCallAccum.get(idx)!;

              // Accumulate id if it arrives late (some providers split it)
              if (tcDelta.id && accum.id !== tcDelta.id) {
                accum.id = tcDelta.id;
              }

              // Accumulate function name if it arrives in pieces
              if (tcDelta.function?.name) {
                accum.name += tcDelta.function.name;
              }

              // Accumulate arguments delta
              if (tcDelta.function?.arguments) {
                accum.arguments += tcDelta.function.arguments;
                yield { type: 'tool_call_delta', id: accum.id, argumentsDelta: tcDelta.function.arguments };
              }
            }
          }

          // --- finish_reason ---
          if (choice.finish_reason) {
            // Flush remaining tool calls before done
            for (const [, tc] of toolCallAccum) {
              yield { type: 'tool_call_end', id: tc.id };
            }
            toolCallAccum.clear();
            yield { type: 'done', stopReason: choice.finish_reason };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  protected buildHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  protected buildRequestBody(request: CompletionRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: request.messages,
      stream,
    };

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    if (request.maxTokens !== undefined) {
      body.max_tokens = request.maxTokens;
    }

    if (request.tools && request.tools.length > 0 && this.supportsToolUse()) {
      body.tools = request.tools.map(toolToOpenAI);
      body.tool_choice = 'auto';
    }

    // Thinking / reasoning params — subclasses can override buildRequestBody
    // to inject provider-specific thinking params
    if (request.thinking && this.supportsThinking()) {
      this.applyThinkingParams(body, request);
    }

    // Forward any extra provider-specific params
    if (request.extra) {
      Object.assign(body, request.extra);
    }

    return body;
  }

  /**
   * Override in subclasses to inject provider-specific thinking parameters.
   * Default implementation does nothing.
   */
  protected applyThinkingParams(
    body: Record<string, unknown>,
    request: CompletionRequest,
  ): void {
    // Default: no-op. DeepSeek subclass adds { thinking: { type: "enabled" }, reasoning_effort }
  }

  protected async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });

        // Retry on rate-limit or server errors
        if (res.status === 429 || res.status >= 500) {
          const delay = 1000 * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        return res;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries - 1) {
          await sleep(1000 * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new Error(`${this.name}: max retries exceeded`);
  }
}

// ---------------------------------------------------------------------------
// Internal accumulator type
// ---------------------------------------------------------------------------

interface AccumToolCall {
  id: string;
  name: string;
  arguments: string;
}

// ---------------------------------------------------------------------------
// OpenAI wire types (minimal, for parsing)
// ---------------------------------------------------------------------------

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: ProviderToolCall[];
    };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function toolToOpenAI(tool: ToolDefinition): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
