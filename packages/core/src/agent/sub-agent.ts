/**
 * sub-agent.ts
 *
 * SubAgentManager — spawn child agents that run in parallel with independent
 * message histories. The parent agent delegates tasks and collects results.
 *
 * Design:
 *  - Each sub-agent gets its own LLMProvider instance and ToolRegistry clone.
 *  - Sub-agents share the same tool *definitions* as the parent but execute
 *    independently (no shared state, no approval propagation by default).
 *  - A configurable concurrency limit (default 3) prevents runaway spawning.
 *  - Results are returned as plain strings (the sub-agent's final reply).
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AgentConfig, ProviderConfig } from '@aide/shared';
import { Agent } from '../agent.js';
import { providerRegistry } from '../provider/registry.js';
import { createDefaultTools } from '../tools/index.js';

// ---------------------------------------------------------------------------
// SharedContext
// ---------------------------------------------------------------------------

export class SharedContext {
  private store = new Map<string, unknown>();

  set(key: string, value: unknown): void { this.store.set(key, value); }
  get(key: string): unknown | undefined { return this.store.get(key); }
  has(key: string): boolean { return this.store.has(key); }
  delete(key: string): boolean { return this.store.delete(key); }
  keys(): string[] { return [...this.store.keys()]; }
  toJSON(): Record<string, unknown> {
    return Object.fromEntries(this.store);
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SubAgentConfig {
  /** Task description sent as the first user message. */
  task: string;
  /** Override any fields from the parent AgentConfig. */
  agentConfig?: Partial<AgentConfig>;
  /** Override the provider for this sub-agent. Defaults to parent's provider. */
  providerConfig?: ProviderConfig;
}

export interface SubAgentResult {
  id: string;
  task: string;
  reply: string;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** Whether the sub-agent finished with an error. */
  isError: boolean;
  error?: string;
}

export interface SubAgentManagerEvents {
  /** Fired when a sub-agent is spawned. */
  spawned: [id: string, task: string];
  /** Fired when a sub-agent produces a streaming content chunk. */
  content: [id: string, delta: string];
  /** Fired when a sub-agent finishes (success or error). */
  finished: [result: SubAgentResult];
  /** Fired when the concurrency limit is hit and a task is queued. */
  queued: [task: string, queueLength: number];
  /** Fired when a sub-agent sends a message to another agent. */
  message: [fromId: string, toId: string, content: string];
}

export interface SubAgentManager {
  on<K extends keyof SubAgentManagerEvents>(
    event: K,
    listener: (...args: SubAgentManagerEvents[K]) => void,
  ): this;
  emit<K extends keyof SubAgentManagerEvents>(
    event: K,
    ...args: SubAgentManagerEvents[K]
  ): boolean;
}

// ---------------------------------------------------------------------------
// SubAgentManager
// ---------------------------------------------------------------------------

export class SubAgentManager extends EventEmitter {
  private readonly maxConcurrent: number;
  private readonly parentConfig: AgentConfig;
  private readonly parentProviderConfig: ProviderConfig;

  /** Shared context accessible by all agents in this session. */
  readonly sharedContext = new SharedContext();

  /** Currently running sub-agents (id → Agent). */
  private running = new Map<string, Agent>();

  /** Pending tasks waiting for a slot. */
  private queue: Array<{
    id: string;
    config: SubAgentConfig;
    resolve: (result: SubAgentResult) => void;
    reject: (err: Error) => void;
  }> = [];

  constructor(
    parentConfig: AgentConfig,
    parentProviderConfig: ProviderConfig,
    maxConcurrent = 3,
  ) {
    super();
    this.parentConfig = parentConfig;
    this.parentProviderConfig = parentProviderConfig;
    this.maxConcurrent = maxConcurrent;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Spawn a sub-agent to handle `task`.
   * If the concurrency limit is reached the task is queued and will start
   * automatically once a running agent finishes.
   *
   * @returns The sub-agent's final reply string.
   */
  async spawn(task: string, config?: Partial<AgentConfig>): Promise<string> {
    const result = await this.spawnFull({ task, agentConfig: config });
    if (result.isError) {
      throw new Error(result.error ?? 'Sub-agent failed');
    }
    return result.reply;
  }

  /**
   * Spawn a sub-agent and return the full SubAgentResult (including timing
   * and error information).
   */
  async spawnFull(config: SubAgentConfig): Promise<SubAgentResult> {
    return new Promise((resolve, reject) => {
      const id = randomUUID();

      if (this.running.size < this.maxConcurrent) {
        this.startAgent(id, config, resolve, reject);
      } else {
        this.queue.push({ id, config, resolve, reject });
        this.emit('queued', config.task, this.queue.length);
      }
    });
  }

  /**
   * Spawn multiple tasks in parallel (up to maxConcurrent at a time).
   * Returns results in the same order as the input tasks.
   */
  async spawnAll(tasks: SubAgentConfig[]): Promise<SubAgentResult[]> {
    return Promise.all(tasks.map((cfg) => this.spawnFull(cfg)));
  }

  /** Number of currently running sub-agents. */
  get activeCount(): number {
    return this.running.size;
  }

  /** Number of queued tasks waiting for a slot. */
  get queuedCount(): number {
    return this.queue.length;
  }

  /** Send a message from one agent to another, emitting the 'message' event. */
  sendMessage(fromId: string, toId: string, content: string): void {
    this.emit('message', fromId, toId, content);
  }

  /** Cancel all running sub-agents and clear the queue. */
  cancelAll(): void {
    for (const agent of this.running.values()) {
      agent.cancel();
    }
    this.running.clear();

    // Reject all queued tasks
    for (const item of this.queue) {
      item.reject(new Error('SubAgentManager cancelled'));
    }
    this.queue = [];
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private startAgent(
    id: string,
    config: SubAgentConfig,
    resolve: (result: SubAgentResult) => void,
    reject: (err: Error) => void,
  ): void {
    const startedAt = Date.now();

    // Build merged AgentConfig
    const mergedConfig: AgentConfig = {
      ...this.parentConfig,
      ...config.agentConfig,
      // Always ensure provider is set
      provider: config.providerConfig ?? this.parentProviderConfig,
    };

    // Build a fresh ToolRegistry for this sub-agent (same tools, isolated state)
    const registry = createDefaultTools(mergedConfig.workingDirectory);

    // Get (or create) a provider instance
    const providerCfg = config.providerConfig ?? this.parentProviderConfig;
    const provider = providerRegistry.get(providerCfg);

    const agent = new Agent(provider, registry, mergedConfig);
    this.running.set(id, agent);

    this.emit('spawned', id, config.task);

    // Forward streaming content
    agent.on('content', (delta) => this.emit('content', id, delta));

    // Run the agent
    agent
      .run(config.task)
      .then((reply) => {
        const result: SubAgentResult = {
          id,
          task: config.task,
          reply,
          durationMs: Date.now() - startedAt,
          isError: false,
        };
        this.emit('finished', result);
        resolve(result);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        const result: SubAgentResult = {
          id,
          task: config.task,
          reply: '',
          durationMs: Date.now() - startedAt,
          isError: true,
          error: message,
        };
        this.emit('finished', result);
        // Resolve (not reject) so spawnAll doesn't short-circuit on one failure
        resolve(result);
      })
      .finally(() => {
        this.running.delete(id);
        this.drainQueue();
      });
  }

  private drainQueue(): void {
    while (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
      const next = this.queue.shift()!;
      this.startAgent(next.id, next.config, next.resolve, next.reject);
    }
  }
}
