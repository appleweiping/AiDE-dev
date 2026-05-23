#!/usr/bin/env node
import { cac } from 'cac';
import { Agent } from '@aide/core';
import { ProviderRegistry } from '@aide/core';
import { createDefaultTools } from '@aide/core';
import { APP_NAME, APP_VERSION } from '@aide/shared';
import { startRepl } from './repl.js';

const cli = cac(APP_NAME.toLowerCase());

cli
  .command('[message]', '与 AI 对话或启动交互模式')
  .option('-p, --provider <id>', '选择 provider (deepseek/qwen/glm/kimi/doubao/minimax)')
  .option('-m, --model <model>', '指定模型 ID')
  .option('-k, --key <key>', 'API Key')
  .option('--base-url <url>', '自定义 API base URL')
  .option('-d, --dir <dir>', '工作目录', { default: process.cwd() })
  .option('--thinking', '启用思考模式')
  .option('--no-stream', '禁用流式输出')
  .action(async (message: string | undefined, options) => {
    const registry = new ProviderRegistry();

    const providerId = options.provider || process.env.AIDE_PROVIDER || 'deepseek';
    const apiKey = options.key || process.env.AIDE_API_KEY;
    const baseUrl = options.baseUrl || process.env.AIDE_BASE_URL;
    const model = options.model || process.env.AIDE_MODEL;

    if (!apiKey) {
      console.error('错误: 请提供 API Key (--key 或 AIDE_API_KEY 环境变量)');
      process.exit(1);
    }

    const provider = registry.create({
      id: providerId,
      name: providerId,
      baseUrl: baseUrl || registry.getPreset(providerId)?.baseUrl || '',
      apiKey,
      model: model || registry.getPreset(providerId)?.models[0]?.id || '',
    });

    if (message) {
      const agent = new Agent(provider, createDefaultTools(options.dir), {
        maxIterations: 50,
        thinkingEnabled: options.thinking || false,
        thinkingEffort: 'medium',
        permissionMode: 'safe',
        workingDirectory: options.dir,
        provider: {
          id: providerId,
          name: providerId,
          baseUrl: baseUrl || '',
          apiKey,
          model: model || '',
        },
      });

      agent.on('content', (delta: string) => process.stdout.write(delta));
      agent.on('reasoning', (delta: string) => process.stderr.write(`💭 ${delta}`));
      agent.on('toolStart', (name: string) => process.stderr.write(`\n🔧 ${name}...\n`));
      agent.on('toolEnd', (name: string, result: string, isError: boolean) => {
        if (isError) process.stderr.write(`❌ ${name} failed\n`);
      });
      agent.on('done', () => {
        process.stdout.write('\n');
        process.exit(0);
      });
      agent.on('error', (err: Error) => {
        console.error(`\n错误: ${err.message}`);
        process.exit(1);
      });

      await agent.run(message);
    } else {
      await startRepl(provider, options);
    }
  });

cli.help();
cli.version(APP_VERSION);
cli.parse();
