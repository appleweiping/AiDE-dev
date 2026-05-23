import * as readline from 'node:readline';
import { Agent } from '@aide/core';
import { createDefaultTools } from '@aide/core';
import type { LLMProvider } from '@aide/core';

interface ReplOptions {
  dir: string;
  thinking?: boolean;
}

export async function startRepl(provider: LLMProvider, options: ReplOptions): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('AiDE 交互模式 (输入 /quit 退出, /help 查看帮助)\n');

  const prompt = () => {
    rl.question('> ', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed === '/quit' || trimmed === '/exit') {
        rl.close();
        process.exit(0);
      }

      if (trimmed === '/help') {
        console.log(`
命令:
  /quit, /exit  退出
  /clear        清除上下文
  /help         显示帮助
`);
        prompt();
        return;
      }

      const agent = new Agent(provider, createDefaultTools(options.dir), {
        maxIterations: 50,
        thinkingEnabled: options.thinking || false,
        thinkingEffort: 'medium',
        permissionMode: 'safe',
        workingDirectory: options.dir,
        provider: {
          id: 'cli',
          name: 'cli',
          baseUrl: '',
          apiKey: '',
          model: '',
        },
      });

      agent.on('content', (delta: string) => process.stdout.write(delta));
      agent.on('reasoning', (delta: string) => process.stderr.write(delta));
      agent.on('toolStart', (name: string) => process.stderr.write(`\n🔧 ${name}...\n`));
      agent.on('toolEnd', (_name: string, _result: string, isError: boolean) => {
        if (isError) process.stderr.write('❌ 执行失败\n');
      });
      agent.on('error', (err: Error) => {
        console.error(`\n错误: ${err.message}`);
      });

      await agent.run(trimmed);
      process.stdout.write('\n\n');
      prompt();
    });
  };

  prompt();
}
