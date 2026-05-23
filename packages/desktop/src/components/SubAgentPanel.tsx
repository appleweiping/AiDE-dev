import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface SubAgent {
  id: string;
  task: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  progress: number; // 0-100
  output: string[];
  result?: string;
  startedAt: number;
  finishedAt?: number;
}

interface Props {
  agents?: SubAgent[];
  onCancel?: (id: string) => void;
}

const DEMO_AGENTS: SubAgent[] = [
  {
    id: 'agent-1',
    task: 'Analyze codebase structure and identify refactoring opportunities',
    status: 'running',
    progress: 62,
    output: [
      'Reading src/App.tsx...',
      'Reading src/components/Chat.tsx...',
      'Analyzing import graph...',
      'Found 3 circular dependencies',
      'Checking component sizes...',
    ],
    startedAt: Date.now() - 45000,
  },
  {
    id: 'agent-2',
    task: 'Write unit tests for Settings component',
    status: 'done',
    progress: 100,
    output: [
      'Scaffolding test file...',
      'Writing test: renders correctly',
      'Writing test: saves settings',
      'Writing test: validates API key',
      'All 8 tests written',
    ],
    result: 'Created src/components/__tests__/Settings.test.tsx with 8 passing tests.',
    startedAt: Date.now() - 120000,
    finishedAt: Date.now() - 30000,
  },
  {
    id: 'agent-3',
    task: 'Generate API documentation',
    status: 'error',
    progress: 35,
    output: [
      'Scanning TypeScript types...',
      'Error: Cannot read tsconfig.json',
    ],
    result: 'Failed: tsconfig.json not found in working directory.',
    startedAt: Date.now() - 60000,
    finishedAt: Date.now() - 55000,
  },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

export default function SubAgentPanel({ agents = DEMO_AGENTS, onCancel }: Props) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const outputRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll running agent outputs
  useEffect(() => {
    for (const agent of agents) {
      if (agent.status === 'running') {
        const el = outputRefs.current[agent.id];
        if (el) el.scrollTop = el.scrollHeight;
      }
    }
  }, [agents]);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function statusColor(status: SubAgent['status']) {
    switch (status) {
      case 'running': return 'text-[#4fc1ff]';
      case 'done': return 'text-[#4ec9b0]';
      case 'error': return 'text-[#f44747]';
      case 'cancelled': return 'text-[#6b6b6b]';
    }
  }

  function statusDot(status: SubAgent['status']) {
    switch (status) {
      case 'running': return 'bg-[#4fc1ff] animate-pulse';
      case 'done': return 'bg-[#4ec9b0]';
      case 'error': return 'bg-[#f44747]';
      case 'cancelled': return 'bg-[#6b6b6b]';
    }
  }

  function statusLabel(status: SubAgent['status']) {
    switch (status) {
      case 'running': return t('subAgent.running');
      case 'done': return t('subAgent.done');
      case 'error': return t('subAgent.error');
      case 'cancelled': return t('subAgent.cancelled');
    }
  }

  const runningAgents = agents.filter((a) => a.status === 'running');
  const finishedAgents = agents.filter((a) => a.status !== 'running');

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#252526]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3e3e42] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">
          {t('subAgent.title')}
        </span>
        <div className="flex items-center gap-2">
          {runningAgents.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#4fc1ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4fc1ff] animate-pulse" />
              {runningAgents.length} {t('subAgent.active')}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 p-2">
        {agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mb-2 text-[#3e3e42]">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
              <path d="M10 16h12M16 10v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-xs text-[#6b6b6b]">{t('subAgent.empty')}</p>
          </div>
        )}

        {/* Running agents */}
        {runningAgents.map((agent) => (
          <div key={agent.id} className="rounded border border-[#3e3e42] bg-[#2d2d30]">
            <div className="flex items-start gap-2 px-3 py-2">
              <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${statusDot(agent.status)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#cccccc] leading-snug">{agent.task}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`text-xs ${statusColor(agent.status)}`}>{statusLabel(agent.status)}</span>
                  <span className="text-xs text-[#6b6b6b]">
                    {formatDuration(Date.now() - agent.startedAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onCancel?.(agent.id)}
                className="flex-shrink-0 rounded border border-[#f44747]/40 px-2 py-0.5 text-xs text-[#f44747] hover:bg-[#f44747]/10 transition-colors"
              >
                {t('subAgent.cancel')}
              </button>
            </div>

            {/* Progress bar */}
            <div className="mx-3 mb-2 h-1 overflow-hidden rounded-full bg-[#3e3e42]">
              <div
                className="h-full rounded-full bg-[#0e639c] transition-all duration-300"
                style={{ width: `${agent.progress}%` }}
              />
            </div>

            {/* Streaming output */}
            <div
              ref={(el) => { outputRefs.current[agent.id] = el; }}
              className="mx-3 mb-2 max-h-24 overflow-y-auto rounded bg-[#1e1e1e] px-2 py-1.5"
            >
              {agent.output.map((line, i) => (
                <p key={i} className="font-mono text-xs text-[#9d9d9d] leading-relaxed">{line}</p>
              ))}
              {agent.status === 'running' && (
                <span className="inline-block h-3 w-1.5 animate-pulse bg-[#cccccc]" />
              )}
            </div>
          </div>
        ))}

        {/* Finished agents */}
        {finishedAgents.length > 0 && (
          <div>
            <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">
              {t('subAgent.completed')}
            </p>
            {finishedAgents.map((agent) => (
              <div key={agent.id} className="mb-2 rounded border border-[#3e3e42] bg-[#2d2d30]">
                <button
                  onClick={() => toggleCollapse(agent.id)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left"
                >
                  <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${statusDot(agent.status)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#cccccc] leading-snug truncate">{agent.task}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className={`text-xs ${statusColor(agent.status)}`}>{statusLabel(agent.status)}</span>
                      {agent.finishedAt && (
                        <span className="text-xs text-[#6b6b6b]">
                          {formatDuration(agent.finishedAt - agent.startedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                    className={`mt-1 flex-shrink-0 text-[#6b6b6b] transition-transform ${collapsed.has(agent.id) ? '' : 'rotate-90'}`}
                  >
                    <path d="M3 2l4 3-4 3V2z" />
                  </svg>
                </button>

                {!collapsed.has(agent.id) && (
                  <div className="border-t border-[#3e3e42] px-3 py-2 space-y-2">
                    {agent.result && (
                      <p className={`text-xs ${agent.status === 'error' ? 'text-[#f44747]' : 'text-[#4ec9b0]'}`}>
                        {agent.result}
                      </p>
                    )}
                    <div className="max-h-20 overflow-y-auto rounded bg-[#1e1e1e] px-2 py-1.5">
                      {agent.output.map((line, i) => (
                        <p key={i} className="font-mono text-xs text-[#9d9d9d] leading-relaxed">{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
