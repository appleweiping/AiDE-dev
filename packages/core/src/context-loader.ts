import { readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BYTE_BUDGET = 32 * 1024;
const CONTEXT_FILENAMES = ['AIDE.md', 'CLAUDE.md', 'AGENTS.md'];
const OVERRIDE_FILENAME = 'AIDE.override.md';

export interface ContextFile {
  path: string;
  content: string;
  source: 'global' | 'project' | 'override';
}

export interface LoadedContext {
  files: ContextFile[];
  totalBytes: number;
  truncated: boolean;
}

async function readIfExists(path: string): Promise<string | null> {
  try { return await readFile(path, 'utf-8'); } catch { return null; }
}

async function findGitRoot(startDir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', startDir, 'rev-parse', '--show-toplevel']);
    return stdout.trim();
  } catch { return null; }
}

function getDirsFromRootToCwd(gitRoot: string, cwd: string): string[] {
  const root = resolve(gitRoot);
  const current = resolve(cwd);
  if (!current.startsWith(root)) return [current];
  const dirs: string[] = [];
  let dir = current;
  while (dir.startsWith(root)) {
    dirs.unshift(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirs;
}

export async function loadProjectContext(workingDirectory: string): Promise<LoadedContext> {
  const files: ContextFile[] = [];
  let totalBytes = 0;
  let truncated = false;

  function addContent(path: string, content: string, source: ContextFile['source']): boolean {
    if (totalBytes >= BYTE_BUDGET) { truncated = true; return false; }
    const remaining = BYTE_BUDGET - totalBytes;
    const trimmed = content.length > remaining ? content.slice(0, remaining) : content;
    if (trimmed.length < content.length) truncated = true;
    files.push({ path, content: trimmed, source });
    totalBytes += trimmed.length;
    return true;
  }

  const globalPath = join(homedir(), '.aide', 'AIDE.md');
  const globalContent = await readIfExists(globalPath);
  if (globalContent) addContent(globalPath, globalContent, 'global');

  const gitRoot = await findGitRoot(workingDirectory);
  const dirs = gitRoot
    ? getDirsFromRootToCwd(gitRoot, workingDirectory)
    : [resolve(workingDirectory)];

  for (const dir of dirs) {
    for (const filename of CONTEXT_FILENAMES) {
      const content = await readIfExists(join(dir, filename));
      if (content) { addContent(join(dir, filename), content, 'project'); break; }
    }
  }

  for (const dir of dirs) {
    const content = await readIfExists(join(dir, OVERRIDE_FILENAME));
    if (content) addContent(join(dir, OVERRIDE_FILENAME), content, 'override');
  }

  return { files, totalBytes, truncated };
}

export function formatContextForPrompt(context: LoadedContext): string {
  if (context.files.length === 0) return '';
  const parts: string[] = ['--- project context ---'];
  for (const file of context.files) {
    parts.push(`\n# ${file.path}\n${file.content}`);
  }
  if (context.truncated) parts.push('\n[context truncated at 32KB limit]');
  parts.push('\n--- end project context ---');
  return parts.join('');
}
