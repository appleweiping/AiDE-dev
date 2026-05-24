/**
 * todo.ts — Persistent todo list for AiDE CLI
 *
 * Stores tasks in <workingDirectory>/.aide-todos.json
 * Falls back to ~/.aide/todos.json if no working directory is set.
 *
 * Commands: /todo add <text> [--high|--low]
 *           /todo done <id>
 *           /todo start <id>
 *           /todo remove <id>
 *           /todo clear [all]
 *           /todo list [pending|in_progress|done|all]
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TodoStatus = 'pending' | 'in_progress' | 'done';
export type TodoPriority = 'high' | 'normal' | 'low';

export interface TodoItem {
  id: string;
  text: string;
  status: TodoStatus;
  priority: TodoPriority;
  created: string;
  updated: string;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

let _storePath: string | null = null;

function getStorePath(workingDirectory?: string): string {
  if (_storePath) return _storePath;
  if (workingDirectory) {
    return join(workingDirectory, '.aide-todos.json');
  }
  const dir = join(homedir(), '.aide');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'todos.json');
}

export function setTodoStorePath(path: string): void {
  _storePath = path;
}

function loadTodos(workingDirectory?: string): TodoItem[] {
  const path = getStorePath(workingDirectory);
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as TodoItem[];
  } catch {
    return [];
  }
}

function saveTodos(todos: TodoItem[], workingDirectory?: string): void {
  const path = getStorePath(workingDirectory);
  const dir = join(path, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(todos, null, 2), 'utf-8');
}

function newId(): string {
  return randomBytes(3).toString('hex'); // 6-char hex
}

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function todoAdd(
  text: string,
  priority: TodoPriority = 'normal',
  workingDirectory?: string,
): TodoItem {
  const todos = loadTodos(workingDirectory);
  const item: TodoItem = {
    id: newId(),
    text: text.trim(),
    status: 'pending',
    priority,
    created: now(),
    updated: now(),
  };
  todos.push(item);
  saveTodos(todos, workingDirectory);
  return item;
}

export function todoList(
  filter: TodoStatus | 'all' = 'all',
  workingDirectory?: string,
): TodoItem[] {
  const todos = loadTodos(workingDirectory);
  if (filter === 'all') return todos;
  return todos.filter((t) => t.status === filter);
}

export function todoDone(idPrefix: string, workingDirectory?: string): TodoItem | null {
  const todos = loadTodos(workingDirectory);
  const item = todos.find((t) => t.id.startsWith(idPrefix));
  if (!item) return null;
  item.status = 'done';
  item.updated = now();
  saveTodos(todos, workingDirectory);
  return item;
}

export function todoStart(idPrefix: string, workingDirectory?: string): TodoItem | null {
  const todos = loadTodos(workingDirectory);
  const item = todos.find((t) => t.id.startsWith(idPrefix));
  if (!item) return null;
  item.status = 'in_progress';
  item.updated = now();
  saveTodos(todos, workingDirectory);
  return item;
}

export function todoRemove(idPrefix: string, workingDirectory?: string): boolean {
  const todos = loadTodos(workingDirectory);
  const idx = todos.findIndex((t) => t.id.startsWith(idPrefix));
  if (idx === -1) return false;
  todos.splice(idx, 1);
  saveTodos(todos, workingDirectory);
  return true;
}

export function todoClear(mode: 'done' | 'all' = 'done', workingDirectory?: string): number {
  const todos = loadTodos(workingDirectory);
  const before = todos.length;
  const remaining = mode === 'all' ? [] : todos.filter((t) => t.status !== 'done');
  saveTodos(remaining, workingDirectory);
  return before - remaining.length;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const STATUS_ICON: Record<TodoStatus, string> = {
  pending: '○',
  in_progress: '◉',
  done: '✓',
};

const PRIORITY_COLOR: Record<TodoPriority, string> = {
  high: '\x1b[31m',   // red
  normal: '',
  low: '\x1b[2m',     // dim
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

function fmtItem(t: TodoItem): string {
  const icon = STATUS_ICON[t.status] ?? '?';
  const color = PRIORITY_COLOR[t.priority] ?? '';
  const text =
    t.status === 'done'
      ? `${DIM}${t.text}${RESET}`
      : color
        ? `${color}${t.text}${RESET}`
        : t.text;
  return `  ${icon} ${DIM}[${t.id}]${RESET} ${text}`;
}

export function formatTodoList(todos: TodoItem[]): string {
  if (todos.length === 0) return `  ${DIM}No tasks.${RESET}`;
  return todos.map(fmtItem).join('\n');
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

export function handleTodoCommand(arg: string, workingDirectory?: string): string {
  const parts = arg.trim().split(/\s+/);
  const sub = (parts[0] ?? 'list').toLowerCase();
  const rest = parts.slice(1).join(' ');

  switch (sub) {
    case 'add':
    case 'a': {
      if (!rest) return 'Usage: /todo add <text> [--high|--low]';
      const priority: TodoPriority = rest.includes('--high')
        ? 'high'
        : rest.includes('--low')
          ? 'low'
          : 'normal';
      const text = rest.replace(/--high|--low/g, '').trim();
      if (!text) return 'Task text cannot be empty.';
      const item = todoAdd(text, priority, workingDirectory);
      const color = PRIORITY_COLOR[priority];
      return `  ○ ${DIM}[${item.id}]${RESET} ${color}${item.text}${RESET}  \x1b[92m(added)${RESET}`;
    }

    case 'done':
    case 'd': {
      if (!rest) return 'Usage: /todo done <id>';
      const item = todoDone(rest, workingDirectory);
      return item
        ? `  ✓ ${DIM}[${item.id}]${RESET} ${DIM}${item.text}${RESET}  \x1b[92m(done)${RESET}`
        : `  \x1b[91mNo task matching: ${rest}${RESET}`;
    }

    case 'start':
    case 's': {
      if (!rest) return 'Usage: /todo start <id>';
      const item = todoStart(rest, workingDirectory);
      return item
        ? `  ◉ ${DIM}[${item.id}]${RESET} ${item.text}  \x1b[96m(in progress)${RESET}`
        : `  \x1b[91mNo task matching: ${rest}${RESET}`;
    }

    case 'remove':
    case 'rm':
    case 'r': {
      if (!rest) return 'Usage: /todo remove <id>';
      return todoRemove(rest, workingDirectory)
        ? `  ${DIM}Removed task ${rest}${RESET}`
        : `  \x1b[91mNo task matching: ${rest}${RESET}`;
    }

    case 'clear': {
      const n = todoClear(rest === 'all' ? 'all' : 'done', workingDirectory);
      return `  ${DIM}Cleared ${n} task(s)${RESET}`;
    }

    case 'list':
    case 'ls':
    case '': {
      const validFilters = new Set(['pending', 'in_progress', 'done', 'all']);
      const filter = (validFilters.has(rest) ? rest : 'all') as TodoStatus | 'all';
      const todos = todoList(filter, workingDirectory);
      const all = loadTodos(workingDirectory);
      const pending = all.filter((t) => t.status === 'pending').length;
      const inProgress = all.filter((t) => t.status === 'in_progress').length;
      const done = all.filter((t) => t.status === 'done').length;
      const header = `\n${BOLD}Todo${RESET}  ${DIM}(${pending} pending · ${inProgress} in progress · ${done} done)${RESET}\n`;
      return header + formatTodoList(todos) + '\n';
    }

    default:
      return 'Usage: /todo <add|done|start|remove|clear|list> [args]';
  }
}
