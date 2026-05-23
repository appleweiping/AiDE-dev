import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SandboxOptions {
  /** Docker image to use. Defaults to node:22-slim */
  image?: string;
  /** Working directory inside the container. Defaults to /workspace */
  workdir?: string;
  /** Host directory to mount as /workspace */
  hostWorkdir: string;
  /** Command timeout in ms. Defaults to 30000 */
  timeoutMs?: number;
  /** Max memory (Docker --memory flag). Defaults to 512m */
  memory?: string;
  /** Disable network access inside the container */
  noNetwork?: boolean;
  /** Additional environment variables */
  env?: Record<string, string>;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

// ---------------------------------------------------------------------------
// DockerSandbox
// ---------------------------------------------------------------------------

export class DockerSandbox {
  private readonly image: string;
  private readonly workdir: string;
  private readonly hostWorkdir: string;
  private readonly timeoutMs: number;
  private readonly memory: string;
  private readonly noNetwork: boolean;
  private readonly env: Record<string, string>;

  constructor(options: SandboxOptions) {
    this.image = options.image ?? 'node:22-slim';
    this.workdir = options.workdir ?? '/workspace';
    this.hostWorkdir = resolve(options.hostWorkdir);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.memory = options.memory ?? '512m';
    this.noNetwork = options.noNetwork ?? false;
    this.env = options.env ?? {};
  }

  /** Check if Docker is available on the host */
  static async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('docker', ['info'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Pull the sandbox image if not already present */
  async pullImage(): Promise<void> {
    await execFileAsync('docker', ['pull', this.image], { timeout: 120_000 });
  }

  /** Execute a shell command inside the sandbox container */
  async exec(command: string): Promise<SandboxResult> {
    const containerName = `aide-sandbox-${randomUUID().slice(0, 8)}`;

    const args = [
      'run',
      '--rm',
      '--name', containerName,
      '--workdir', this.workdir,
      '--volume', `${this.hostWorkdir}:${this.workdir}`,
      '--memory', this.memory,
      '--memory-swap', this.memory,
      '--cpus', '1',
      '--security-opt', 'no-new-privileges',
      '--cap-drop', 'ALL',
    ];

    if (this.noNetwork) args.push('--network', 'none');

    for (const [key, val] of Object.entries(this.env)) {
      args.push('--env', `${key}=${val}`);
    }

    args.push(this.image, 'sh', '-c', command);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn('docker', args);

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
        execFileAsync('docker', ['rm', '-f', containerName]).catch(() => {});
      }, this.timeoutMs);

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.slice(0, 100_000),
          stderr: stderr.slice(0, 10_000),
          exitCode: code ?? 1,
          timedOut,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({ stdout: '', stderr: err.message, exitCode: 1, timedOut: false });
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Sandboxed Bash tool factory
// ---------------------------------------------------------------------------

import type { ToolDefinition } from '@aide/shared';
import type { ToolResult } from '../tools/registry.js';

export function createSandboxedBashTool(sandbox: DockerSandbox): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'bash_sandbox',
    description:
      'Execute a shell command inside an isolated Docker container. ' +
      'Use this for running untrusted code, build scripts, or commands that should not affect the host system.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute in the sandbox' },
        timeout: { type: 'number', description: 'Timeout in seconds (default 30)' },
      },
      required: ['command'],
    },
    async execute(args) {
      const available = await DockerSandbox.isAvailable();
      if (!available) {
        return {
          output: 'Docker is not available on this system. Install Docker to use sandboxed execution.',
          isError: true,
        };
      }

      const result = await sandbox.exec(args.command as string);
      const parts: string[] = [];
      if (result.timedOut) parts.push('[TIMED OUT]');
      if (result.stdout) parts.push(result.stdout);
      if (result.stderr) parts.push(`[stderr]\n${result.stderr}`);
      if (parts.length === 0) parts.push('(no output)');

      return {
        output: parts.join('\n'),
        isError: result.exitCode !== 0 || result.timedOut,
      };
    },
  };
}
