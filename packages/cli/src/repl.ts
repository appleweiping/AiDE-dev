import * as readline from 'node:readline';
import { Agent, createDefaultTools, globalSlashRegistry, builtinCommands } from '@aide/core';
import type { LLMProvider } from '@aide/core';

interface ReplOptions {
  dir: string;
  thinking?: boolean;
  permissionMode?: 'safe' | 'trusted' | 'locked';
}

// Register built-in slash commands
for (const cmd of builtinCommands) {
  globalSlashRegistry.register(cmd);
}

export async function startRepl(provider: LLMProvider, options: ReplOptions): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const registry = createDefaultTools(options.dir);
  const agent = await Agent.create(provider, registry, {
    maxIterations: 50,
    thinkingEnabled: options.thinking ?? false,
    thinkingEffort: 'medium',
    permissionMode: options.permissionMode ?? 'safe',
    workingDirectory: options.dir,
    provider: { id: 'cli', name: 'cli', baseUrl: '', apiKey: '', model: '' },
  });

  agent.on('content', (delta: string) => process.stdout.write(delta));
  agent.on('reasoning', (delta: string) => process.stderr.write(`\x1b[2m${delta}\x1b[0m`));
  agent.on('tool_start', (call) => process.stderr.write(`\n\x1b[36m⚙ ${call.name}\x1b[0m\n`));
  agent.on('tool_end', (_call, result) => {
    if (result.isError) process.stderr.write(`\x1b[31m✗ error\x1b[0m\n`);
  });
  agent.on('compacted', (before, after) => {
    process.stderr.write(`\x1b[2m[context compacted: ${before} → ${after} messages]\x1b[0m\n`);
  });
  agent.on('error', (err: Error) => console.error(`\n\x1b[31mError: ${err.message}\x1b[0m`));

  console.log('\x1b[1mAiDE\x1b[0m interactive mode  (type \x1b[36m/help\x1b[0m for commands)\n');

  const prompt = () => {
    rl.question('\x1b[36m❯\x1b[0m ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed) { prompt(); return; }

      // Slash command handling
      if (trimmed.startsWith('/')) {
        const result = await globalSlashRegistry.execute(trimmed, {
          sessionId: undefined,
          workingDirectory: options.dir,
        });

        if (result) {
          if (result.output === '__COMPACT__') {
            const msg = await agent.compactContextAsync();
            console.log(`\x1b[2m${msg}\x1b[0m`);
          } else if (result.output === '__CLEAR__') {
            agent.restoreMessages([]);
            console.log('\x1b[2mContext cleared.\x1b[0m');
          } else if (result.output === '__HELP__') {
            const cmds = globalSlashRegistry.list();
            console.log('\nAvailable commands:');
            for (const cmd of cmds) {
              const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
              console.log(`  \x1b[36m/${cmd.name}\x1b[0m${aliases}  — ${cmd.description}`);
            }
            console.log();
          } else if (result.output.startsWith('__PERMISSIONS_SET__:')) {
            const mode = result.output.split(':')[1] as 'safe' | 'trusted' | 'locked';
            options.permissionMode = mode;
            console.log(`\x1b[2mPermission mode: ${mode}\x1b[0m`);
          } else if (result.output === '__PERMISSIONS_SHOW__') {
            console.log(`\x1b[2mPermission mode: ${options.permissionMode ?? 'safe'}\x1b[0m`);
          } else if (result.injectAsMessage) {
            // Inject as a user message into the agent
            process.stdout.write('\n');
            await agent.run(result.output);
            process.stdout.write('\n\n');
          } else if (result.isError) {
            console.error(`\x1b[31m${result.output}\x1b[0m`);
          } else {
            console.log(result.output);
          }
        }

        prompt();
        return;
      }

      // Regular message
      process.stdout.write('\n');
      await agent.run(trimmed);
      process.stdout.write('\n\n');
      prompt();
    });
  };

  prompt();
}
