import * as vm from 'node:vm';
import { nodeReplDefinition } from './definitions-extra.js';

const sessions = new Map<string, vm.Context>();

export const nodeReplTool = {
  definition: nodeReplDefinition,

  async execute(args: Record<string, unknown>, _workingDirectory: string, sessionId?: string): Promise<string> {
    const code = args.code as string;
    const reset = (args.reset as boolean) || false;
    const sid = sessionId || 'default';

    if (reset) {
      sessions.delete(sid);
    }

    let context = sessions.get(sid);
    if (!context) {
      context = vm.createContext({
        console: {
          log: (...a: unknown[]) => output.push(a.map(String).join(' ')),
          error: (...a: unknown[]) => output.push('[error] ' + a.map(String).join(' ')),
          warn: (...a: unknown[]) => output.push('[warn] ' + a.map(String).join(' ')),
        },
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        Buffer,
        URL,
        URLSearchParams,
        fetch,
        process: { env: process.env, cwd: () => _workingDirectory, platform: process.platform },
      });
      sessions.set(sid, context);
    }

    const output: string[] = [];
    (context as Record<string, unknown>).__output = output;

    try {
      const script = new vm.Script(code, { filename: 'repl.js' });
      const result = script.runInContext(context, { timeout: 30000 });

      let resultStr = '';
      if (output.length > 0) {
        resultStr += output.join('\n');
      }
      if (result !== undefined) {
        const repr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        if (resultStr) resultStr += '\n';
        resultStr += `=> ${repr}`;
      }

      return (resultStr || '(no output)').slice(0, 50000);
    } catch (error) {
      const err = error as Error;
      return `Error: ${err.name}: ${err.message}`;
    }
  },
};
