import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import type { RegisteredTool, ToolResult } from './registry.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;

const DEFINITION = {
  name: 'bash',
  description:
    'Execute a shell command and return its output. ' +
    'On Windows, commands run in PowerShell. On Unix, commands run in bash. ' +
    'Use timeout_ms to override the default 30-second timeout (max 300 seconds). ' +
    'Use working_directory to set the working directory for the command.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute.',
      },
      working_directory: {
        type: 'string',
        description: 'Working directory for the command. Defaults to the current working directory.',
      },
      timeout_ms: {
        type: 'number',
        description: `Timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS}. Max ${MAX_TIMEOUT_MS}.`,
      },
    },
    required: ['command'],
  },
};

async function handler(args: Record<string, unknown>): Promise<ToolResult> {
  const command = String(args.command ?? '').trim();
  if (!command) {
    return { output: 'Error: command is required', isError: true };
  }

  const cwd = args.working_directory
    ? resolve(String(args.working_directory))
    : process.cwd();

  const timeoutMs = typeof args.timeout_ms === 'number'
    ? Math.min(Math.max(1000, args.timeout_ms), MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;

  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'powershell.exe' : 'bash';
  const shellArgs = isWindows ? ['-NonInteractive', '-Command', command] : ['-c', command];

  return new Promise<ToolResult>((resolve_) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(shell, shellArgs, {
      cwd,
      env: process.env,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2000);
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (timedOut) {
        resolve_({
          output: `Command timed out after ${timeoutMs}ms.\nPartial stdout:\n${stdout}\nPartial stderr:\n${stderr}`,
          isError: true,
        });
        return;
      }

      const parts: string[] = [];
      if (stdout) parts.push(stdout);
      if (stderr) parts.push(`[stderr]\n${stderr}`);
      if (code !== 0) parts.push(`[exit code: ${code}]`);

      const output = parts.join('\n').trimEnd();
      resolve_({
        output: output || `(no output, exit code ${code})`,
        isError: code !== 0,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve_({
        output: `Failed to spawn process: ${err.message}`,
        isError: true,
      });
    });
  });
}

export const bashTool: RegisteredTool = {
  definition: DEFINITION,
  handler,
};
