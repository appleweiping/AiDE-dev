import { spawn } from 'node:child_process';
import { powershellDefinition } from './definitions-extra.js';

export const powershellTool = {
  definition: powershellDefinition,

  async execute(args: Record<string, unknown>, workingDirectory: string): Promise<string> {
    const command = args.command as string;
    const timeoutMs = (args.timeoutMs as number) || 120000;
    const cwd = (args.workingDirectory as string) || workingDirectory;

    if (process.platform !== 'win32') {
      return 'Error: PowerShell tool is only available on Windows';
    }

    return new Promise((resolve) => {
      const child = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', command,
      ], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        resolve(`Error spawning PowerShell: ${err.message}`);
      });

      child.on('exit', (code) => {
        let result = '';
        if (stdout) result += stdout;
        if (stderr) result += `\n[stderr]\n${stderr}`;
        if (code !== 0 && code !== null) {
          result += `\n[exit code: ${code}]`;
        }
        resolve(result.trim().slice(0, 50000) || '(no output)');
      });
    });
  },
};
