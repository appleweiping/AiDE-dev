import { EventEmitter } from 'node:events';
import type { AgentConfig, ToolCall, ToolResult } from '@aide/shared';
import { DEFAULT_MAX_ITERATIONS } from '@aide/shared';
import type { LLMProvider, CompletionRequest, ProviderMessage, ProviderToolCall } from './provider/index.js';
import { ToolRegistry } from './tools/registry.js';
import type { ApprovalManager } from './safety/approval.js';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export interface AgentEvents {
  /** Fired at the start of each iteration */
  iteration: [iteration: number, maxIterations: number];
  /** Fired when the LLM starts generating a response */
  thinking: [iteration: number];
  /** Fired for each streaming content chunk */
  content: [delta: string];
  /** Fired for each streaming reasoning chunk */
  reasoning: [delta: string];
  /** Fired when a tool call is about to be executed */
  tool_start: [call: ToolCall];
  /** Fired when a tool call completes */
  tool_end: [call: ToolCall, result: ToolResult, elapsedMs: number];
  /** Fired when the agent produces a final text reply */
  reply: [content: string];
  /** Fired when the agent loop ends (reply, max_iterations, or cancelled) */
  done: [reason: 'reply' | 'max_iterations' | 'cancelled' | 'error', content: string];
  /** Fired on unrecoverable errors */
  error: [err: Error];
}

// ---------------------------------------------------------------------------
// Agent class
// ---------------------------------------------------------------------------

// Typed EventEmitter interface — augments the base class with typed overloads
export interface Agent {
  on<K extends keyof AgentEvents>(event: K, listener: (...args: AgentEvents[K]) => void): this;
  emit<K extends keyof AgentEvents>(event: K, ...args: AgentEvents[K]): boolean;
  off<K extends keyof AgentEvents>(event: K, listener: (...args: AgentEvents[K]) => void): this;
  once<K extends keyof AgentEvents>(event: K, listener: (...args: AgentEvents[K]) => void): this;
}

export class Agent extends EventEmitter {
  private provider: LLMProvider;
  private toolRegistry: ToolRegistry;
  private approvalManager: ApprovalManager | null;
  private config: AgentConfig;
  private messages: ProviderMessage[] = [];
  private abortController: AbortController | null = null;

  constructor(
    provider: LLMProvider,
    toolRegistry: ToolRegistry,
    config: AgentConfig,
    approvalManager?: ApprovalManager,
  ) {
    super();
    this.provider = provider;
    this.toolRegistry = toolRegistry;
    this.config = config;
    this.approvalManager = approvalManager ?? null;

    // Inject system prompt
    this.messages.push({
      role: 'system',
      content: buildSystemPrompt(config),
    });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Send a user message and run the agent loop until a final reply or max iterations. */
  async run(userMessage: string): Promise<string> {
    this.messages.push({ role: 'user', content: userMessage });
    return this.loop();
  }

  /** Cancel the currently running loop. */
  cancel(): void {
    this.abortController?.abort();
  }

  /** Return a copy of the current message history. */
  getMessages(): ProviderMessage[] {
    return [...this.messages];
  }

  /** Replace the message history (e.g. when restoring a session). */
  restoreMessages(messages: ProviderMessage[]): void {
    this.messages = [...messages];
  }

  /** Compact old messages to save context window space. */
  compactContext(keepRecent = 12): string {
    if (this.messages.length <= keepRecent + 1) {
      return 'Context is already compact.';
    }
    const system = this.messages[0];
    const old = this.messages.slice(1, -keepRecent);
    const recent = this.messages.slice(-keepRecent);
    const summary = summarizeMessages(old);
    this.messages = [
      system,
      { role: 'system', content: `Conversation summary (compacted):\n${summary}` },
      ...recent,
    ];
    return `Compacted ${old.length} messages; kept ${recent.length} recent messages.`;
  }

  // -------------------------------------------------------------------------
  // Core loop
  // -------------------------------------------------------------------------

  private async loop(): Promise<string> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const maxIterations = this.config.maxIterations ?? DEFAULT_MAX_ITERATIONS;

    try {
      for (let i = 0; i < maxIterations; i++) {
        if (signal.aborted) {
          this.emit('done', 'cancelled', '');
          return '';
        }

        this.emit('iteration', i + 1, maxIterations);
        this.emit('thinking', i + 1);

        // Build completion request
        const request = this.buildRequest();

        // Stream the response
        let contentAccum = '';
        let reasoningAccum = '';
        const toolCallsAccum = new Map<string, AccumToolCall>();

        try {
          for await (const chunk of this.provider.stream(request, signal)) {
            if (signal.aborted) break;

            switch (chunk.type) {
              case 'content':
                contentAccum += chunk.delta;
                this.emit('content', chunk.delta);
                break;

              case 'reasoning':
                reasoningAccum += chunk.delta;
                this.emit('reasoning', chunk.delta);
                break;

              case 'tool_call_start':
                toolCallsAccum.set(chunk.id, {
                  id: chunk.id,
                  name: chunk.name,
                  arguments: '',
                });
                break;

              case 'tool_call_delta':
                if (toolCallsAccum.has(chunk.id)) {
                  toolCallsAccum.get(chunk.id)!.arguments += chunk.argumentsDelta;
                }
                break;

              case 'tool_call_end':
                // Nothing extra needed — accumulation is complete
                break;

              case 'done':
                // Loop will handle finish
                break;
            }
          }
        } catch (err) {
          if (signal.aborted) {
            this.emit('done', 'cancelled', '');
            return '';
          }
          throw err;
        }

        if (signal.aborted) {
          this.emit('done', 'cancelled', '');
          return '';
        }

        // Build the assistant message
        const toolCalls: ProviderToolCall[] = Array.from(toolCallsAccum.values()).map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        }));

        const assistantMsg: ProviderMessage = {
          role: 'assistant',
          content: contentAccum || null,
          ...(reasoningAccum ? { reasoning_content: reasoningAccum } : {}),
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        };
        this.messages.push(assistantMsg);

        // No tool calls → final reply
        if (toolCalls.length === 0) {
          const reply = contentAccum;
          this.emit('reply', reply);
          this.emit('done', 'reply', reply);
          return reply;
        }

        // Execute tool calls
        for (const tc of toolCalls) {
          if (signal.aborted) break;

          let parsedArgs: Record<string, unknown>;
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            parsedArgs = {};
          }

          const toolCall: ToolCall = {
            id: tc.id,
            name: tc.function.name,
            arguments: parsedArgs,
          };

          this.emit('tool_start', toolCall);
          const startedAt = Date.now();

          // Check approval if needed
          if (this.approvalManager) {
            const approved = await this.approvalManager.requestApproval(toolCall, signal);
            if (!approved) {
              const deniedResult: ToolResult = {
                callId: tc.id,
                content: `Tool call denied by user: ${tc.function.name}`,
                isError: true,
              };
              this.emit('tool_end', toolCall, deniedResult, Date.now() - startedAt);
              this.messages.push({
                role: 'tool',
                content: deniedResult.content,
                tool_call_id: tc.id,
              });
              continue;
            }
          }

          const result = await this.toolRegistry.execute(tc.function.name, parsedArgs);
          const toolResult: ToolResult = {
            callId: tc.id,
            content: result.output,
            isError: result.isError,
          };

          this.emit('tool_end', toolCall, toolResult, Date.now() - startedAt);

          this.messages.push({
            role: 'tool',
            content: result.output,
            tool_call_id: tc.id,
          });
        }
      }

      // Max iterations reached
      this.emit('done', 'max_iterations', '[max iterations reached]');
      return '[max iterations reached]';
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
      this.emit('done', 'error', error.message);
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private buildRequest(): CompletionRequest {
    return {
      messages: this.messages,
      tools: this.toolRegistry.getDefinitions(),
      thinking: this.config.thinkingEnabled,
      thinkingEffort: this.config.thinkingEffort,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface AccumToolCall {
  id: string;
  name: string;
  arguments: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const DEFAULT_SYSTEM_PROMPT = `You are AiDE, an intelligent coding agent running on the user's desktop.
You can read and write files, execute shell commands, and search code to help with software engineering tasks.
Be direct and concise. Use tools to gather information before answering when needed.
Always prefer targeted edits (file_edit) over full rewrites (file_write) when modifying existing files.
When you have completed a task, summarize what you did in 1-3 sentences.`;

function buildSystemPrompt(config: AgentConfig): string {
  return DEFAULT_SYSTEM_PROMPT;
}

function summarizeMessages(messages: ProviderMessage[]): string {
  return messages
    .map((msg, i) => {
      const content = (msg.content ?? '').slice(0, 300);
      const toolCalls = msg.role === 'assistant' && msg.tool_calls
        ? ` [tools: ${msg.tool_calls.map((tc) => tc.function.name).join(', ')}]`
        : '';
      return `${i + 1}. ${msg.role}${toolCalls}: ${content}`;
    })
    .join('\n');
}
