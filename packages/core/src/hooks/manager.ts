import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type HookEvent =
  | 'session:start' | 'session:end' | 'session:error'
  | 'agent:iteration' | 'agent:thinking' | 'agent:reply'
  | 'agent:max_iterations' | 'agent:cancelled'
  | 'tool:before' | 'tool:after' | 'tool:denied' | 'tool:error'
  | 'file:read' | 'file:write' | 'file:edit'
  | 'shell:before' | 'shell:after' | 'shell:error'
  | 'git:commit' | 'git:push' | 'git:branch'
  | 'mcp:tool_call' | 'mcp:connected' | 'mcp:disconnected'
  | 'approval:requested' | 'approval:approved' | 'approval:denied'
  | 'context:compacted' | 'context:loaded'
  | 'plan:enter' | 'plan:exit';

export interface HookDefinition {
  event: HookEvent;
  command: string;
  workingDir?: string;
  timeout?: number;
  blocking?: boolean;
  condition?: string;
}

export interface HookContext {
  event: HookEvent;
  sessionId?: string;
  toolName?: string;
  filePath?: string;
  exitCode?: number;
  error?: string;
  extra?: Record<string, unknown>;
  timestamp: number;
}

export class HooksManager {
  private hooks: HookDefinition[] = [];

  register(hook: HookDefinition): void {
    this.hooks.push(hook);
  }

  unregister(event: HookEvent): void {
    this.hooks = this.hooks.filter((h) => h.event !== event);
  }

  loadFromConfig(hooks: HookDefinition[]): void {
    this.hooks = [...hooks];
  }

  getRegistered(): HookDefinition[] {
    return [...this.hooks];
  }

  async fire(event: HookEvent, ctx: Partial<HookContext> = {}): Promise<void> {
    const matching = this.hooks.filter((h) => h.event === event);
    if (matching.length === 0) return;

    const fullCtx: HookContext = { event, timestamp: Date.now(), ...ctx };
    const env = {
      ...process.env,
      AIDE_HOOK_EVENT: event,
      AIDE_HOOK_CONTEXT: JSON.stringify(fullCtx),
    };

    const runHook = async (hook: HookDefinition): Promise<void> => {
      if (hook.condition && !process.env[hook.condition]) return;
      try {
        await execFileAsync(
          process.platform === 'win32' ? 'cmd' : 'sh',
          process.platform === 'win32' ? ['/c', hook.command] : ['-c', hook.command],
          {
            cwd: hook.workingDir,
            env,
            timeout: hook.timeout ?? 10_000,
          },
        );
      } catch {
        // Hook errors are non-fatal
      }
    };

    const blocking = matching.filter((h) => h.blocking);
    const nonBlocking = matching.filter((h) => !h.blocking);

    for (const hook of blocking) await runHook(hook);
    for (const hook of nonBlocking) runHook(hook).catch(() => {});
  }
}

export const globalHooksManager = new HooksManager();
