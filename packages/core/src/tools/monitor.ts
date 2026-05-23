import { spawn, type ChildProcess } from 'node:child_process';
import { monitorDefinition } from './definitions-extra.js';
import { EventEmitter } from 'node:events';

export interface MonitorInstance {
  id: string;
  description: string;
  process: ChildProcess;
  events: EventEmitter;
  startedAt: number;
}

const activeMonitors = new Map<string, MonitorInstance>();
let monitorCounter = 0;

export const monitorTool = {
  definition: monitorDefinition,

  async execute(args: Record<string, unknown>, workingDirectory: string): Promise<string> {
    const command = args.command as string;
    const description = args.description as string;
    const timeoutMs = (args.timeoutMs as number) || 300000;
    const persistent = (args.persistent as boolean) || false;

    const id = `monitor_${++monitorCounter}`;

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : '/bin/sh';
    const shellArgs = isWindows ? ['-NoProfile', '-Command', command] : ['-c', command];

    const child = spawn(shell, shellArgs, {
      cwd: workingDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const events = new EventEmitter();
    const monitor: MonitorInstance = { id, description, process: child, events, startedAt: Date.now() };
    activeMonitors.set(id, monitor);

    let lineBuffer = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          events.emit('event', line.trim());
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      events.emit('stderr', chunk.toString());
    });

    child.on('exit', (code) => {
      events.emit('exit', code);
      activeMonitors.delete(id);
    });

    if (!persistent) {
      setTimeout(() => {
        if (activeMonitors.has(id)) {
          child.kill();
          activeMonitors.delete(id);
        }
      }, timeoutMs);
    }

    return `Monitor started: ${id}\nDescription: ${description}\nCommand: ${command}\nTimeout: ${persistent ? 'persistent' : `${timeoutMs}ms`}`;
  },
};

export function stopMonitor(id: string): string {
  const monitor = activeMonitors.get(id);
  if (!monitor) {
    return `Monitor ${id} not found or already stopped`;
  }
  monitor.process.kill();
  activeMonitors.delete(id);
  return `Monitor ${id} stopped`;
}

export function listMonitors(): MonitorInstance[] {
  return Array.from(activeMonitors.values());
}

export function getMonitorEvents(id: string): EventEmitter | null {
  return activeMonitors.get(id)?.events || null;
}
