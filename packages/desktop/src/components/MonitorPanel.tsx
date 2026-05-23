import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MonitorStatus = 'running' | 'stopped';

export interface MonitorEvent {
  timestamp: number;
  text: string;
}

export interface MonitorInfo {
  id: string;
  description: string;
  status: MonitorStatus;
  eventCount: number;
  events: MonitorEvent[];
}

export interface MonitorPanelProps {
  monitors: MonitorInfo[];
  onStop: (id: string) => void;
}

// ── Single monitor card ───────────────────────────────────────────────────────

function MonitorCard({ monitor, onStop }: { monitor: MonitorInfo; onStop: (id: string) => void }) {
  const { t } = useTranslation();
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest event
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [monitor.events]);

  const isRunning = monitor.status === 'running';

  return (
    <div className="flex flex-col rounded border border-[#3e3e42] bg-[#252526] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#3e3e42]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status dot */}
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ${
              isRunning ? 'bg-[#4ec9b0]' : 'bg-[#6b6b6b]'
            }`}
            style={isRunning ? { animation: 'pulse-dot 1.4s ease-in-out infinite' } : undefined}
          />
          <span className="truncate text-xs font-medium text-[#cccccc]">
            {monitor.description}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Event count badge */}
          <span className="rounded bg-[#3e3e42] px-1.5 py-0.5 text-[10px] text-[#9d9d9d]">
            {monitor.eventCount} {t('monitor.events')}
          </span>

          {/* Status label */}
          <span className={`text-xs ${isRunning ? 'text-[#4ec9b0]' : 'text-[#6b6b6b]'}`}>
            {t(`monitor.status.${monitor.status}`)}
          </span>

          {/* Stop button */}
          {isRunning && (
            <button
              onClick={() => onStop(monitor.id)}
              className="rounded px-2 py-0.5 text-xs text-[#f48771] hover:bg-[#3a1a1a] transition-colors border border-[#f48771]/30"
              title={t('monitor.stop')}
            >
              {t('monitor.stop')}
            </button>
          )}
        </div>
      </div>

      {/* Event log */}
      <div
        ref={logRef}
        className="max-h-32 overflow-y-auto bg-[#1e1e1e] p-2 font-mono text-[11px]"
      >
        {monitor.events.length === 0 ? (
          <span className="text-[#6b6b6b]">{t('monitor.noEvents')}</span>
        ) : (
          monitor.events.map((event, idx) => (
            <div key={idx} className="flex gap-2 leading-5">
              <span className="flex-shrink-0 text-[#6b6b6b]">
                {new Date(event.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className="text-[#cccccc] whitespace-pre-wrap break-all">{event.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MonitorPanel({ monitors, onStop }: MonitorPanelProps) {
  const { t } = useTranslation();

  const runningCount = monitors.filter((m) => m.status === 'running').length;

  return (
    <div className="flex flex-col gap-2">
      {/* Panel header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#9d9d9d] uppercase tracking-wider">
            {t('monitor.title')}
          </span>
          {runningCount > 0 && (
            <span className="rounded-full bg-[#0e639c] px-1.5 py-0.5 text-[10px] text-white">
              {runningCount}
            </span>
          )}
        </div>
        <span className="text-xs text-[#6b6b6b]">
          {monitors.length} {t('monitor.total')}
        </span>
      </div>

      {/* Monitor cards */}
      {monitors.length === 0 ? (
        <div className="rounded border border-[#3e3e42] bg-[#252526] px-4 py-6 text-center text-xs text-[#6b6b6b]">
          {t('monitor.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {monitors.map((monitor) => (
            <MonitorCard key={monitor.id} monitor={monitor} onStop={onStop} />
          ))}
        </div>
      )}
    </div>
  );
}
