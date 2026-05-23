import { EventEmitter } from 'node:events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlashCommandContext {
  sessionId?: string;
  workingDirectory?: string;
  args: string;
  rawInput: string;
}

export interface SlashCommandResult {
  output: string;
  isError: boolean;
  /** If true, inject output as a user message into the agent loop */
  injectAsMessage?: boolean;
}

export type SlashCommandHandler = (ctx: SlashCommandContext) => Promise<SlashCommandResult>;

export interface SlashCommandDefinition {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  handler: SlashCommandHandler;
}

export interface SlashCommandRegistryEvents {
  executed: [name: string, result: SlashCommandResult];
  notFound: [input: string];
}

export interface SlashCommandRegistry {
  on<K extends keyof SlashCommandRegistryEvents>(
    event: K,
    listener: (...args: SlashCommandRegistryEvents[K]) => void,
  ): this;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class SlashCommandRegistry extends EventEmitter {
  private commands = new Map<string, SlashCommandDefinition>();

  register(cmd: SlashCommandDefinition): void {
    this.commands.set(cmd.name, cmd);
    for (const alias of cmd.aliases ?? []) {
      this.commands.set(alias, cmd);
    }
  }

  unregister(name: string): void {
    const cmd = this.commands.get(name);
    if (!cmd) return;
    this.commands.delete(cmd.name);
    for (const alias of cmd.aliases ?? []) {
      this.commands.delete(alias);
    }
  }

  get(name: string): SlashCommandDefinition | undefined {
    return this.commands.get(name);
  }

  list(): SlashCommandDefinition[] {
    const seen = new Set<string>();
    const result: SlashCommandDefinition[] = [];
    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        result.push(cmd);
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Parse and execute a raw input string like "/review main" */
  async execute(rawInput: string, ctx: Omit<SlashCommandContext, 'args' | 'rawInput'>): Promise<SlashCommandResult | null> {
    const trimmed = rawInput.trim();
    if (!trimmed.startsWith('/')) return null;

    const spaceIdx = trimmed.indexOf(' ');
    const name = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx);
    const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

    const cmd = this.commands.get(name);
    if (!cmd) {
      this.emit('notFound', rawInput);
      return { output: `Unknown command: /${name}. Type /help to list commands.`, isError: true };
    }

    const result = await cmd.handler({ ...ctx, args, rawInput });
    this.emit('executed', name, result);
    return result;
  }

  /** Returns true if the input looks like a slash command */
  isCommand(input: string): boolean {
    return input.trim().startsWith('/');
  }
}

export const globalSlashRegistry = new SlashCommandRegistry();
