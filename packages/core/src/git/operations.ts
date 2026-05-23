import { spawn } from 'node:child_process';
import * as path from 'node:path';

export class GitOperations {
  constructor(private workingDirectory: string) {}

  async exec(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      const child = spawn('git', args, {
        cwd: this.workingDirectory,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on('exit', (code) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code || 0 });
      });

      child.on('error', (err) => {
        resolve({ stdout: '', stderr: err.message, code: 1 });
      });
    });
  }

  async status(): Promise<string> {
    const { stdout } = await this.exec(['status', '--porcelain']);
    return stdout;
  }

  async branch(): Promise<string> {
    const { stdout } = await this.exec(['branch', '--show-current']);
    return stdout;
  }

  async log(count = 10): Promise<string> {
    const { stdout } = await this.exec(['log', `--oneline`, `-${count}`]);
    return stdout;
  }

  async diff(staged = false): Promise<string> {
    const args = staged ? ['diff', '--staged'] : ['diff'];
    const { stdout } = await this.exec(args);
    return stdout;
  }

  async add(files: string[]): Promise<string> {
    const { stdout, stderr, code } = await this.exec(['add', ...files]);
    return code === 0 ? (stdout || 'Files staged') : `Error: ${stderr}`;
  }

  async commit(message: string): Promise<string> {
    const { stdout, stderr, code } = await this.exec(['commit', '-m', message]);
    return code === 0 ? stdout : `Error: ${stderr}`;
  }

  async createBranch(name: string): Promise<string> {
    const { stdout, stderr, code } = await this.exec(['checkout', '-b', name]);
    return code === 0 ? `Created and switched to branch: ${name}` : `Error: ${stderr}`;
  }

  async push(remote = 'origin', branch?: string): Promise<string> {
    const currentBranch = branch || await this.branch();
    const { stdout, stderr, code } = await this.exec(['push', '-u', remote, currentBranch]);
    return code === 0 ? (stdout || stderr || 'Pushed successfully') : `Error: ${stderr}`;
  }

  async isRepo(): Promise<boolean> {
    const { code } = await this.exec(['rev-parse', '--is-inside-work-tree']);
    return code === 0;
  }
}

export class WorktreeManager {
  private baseDir: string;

  constructor(private workingDirectory: string) {
    this.baseDir = path.join(workingDirectory, '.aide', 'worktrees');
  }

  async create(name: string): Promise<{ path: string; branch: string } | string> {
    const git = new GitOperations(this.workingDirectory);

    const { stdout: defaultBranch } = await git.exec(['symbolic-ref', 'refs/remotes/origin/HEAD', '--short']);
    const base = defaultBranch.replace('origin/', '') || 'main';

    const worktreePath = path.join(this.baseDir, name);
    const branchName = `aide/${name}`;

    const { stderr, code } = await git.exec([
      'worktree', 'add', '-b', branchName, worktreePath, `origin/${base}`,
    ]);

    if (code !== 0) {
      return `Error creating worktree: ${stderr}`;
    }

    return { path: worktreePath, branch: branchName };
  }

  async remove(name: string, force = false): Promise<string> {
    const git = new GitOperations(this.workingDirectory);
    const worktreePath = path.join(this.baseDir, name);

    const args = force
      ? ['worktree', 'remove', '--force', worktreePath]
      : ['worktree', 'remove', worktreePath];

    const { stderr, code } = await git.exec(args);
    if (code !== 0) return `Error: ${stderr}`;

    return `Worktree ${name} removed`;
  }

  async list(): Promise<string> {
    const git = new GitOperations(this.workingDirectory);
    const { stdout } = await git.exec(['worktree', 'list']);
    return stdout;
  }
}
