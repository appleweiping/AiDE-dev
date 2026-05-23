import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface TaskItem {
  id: string;
  content: string;
  activeForm: string;
  status: TaskStatus;
}

export interface TaskListProps {
  tasks: TaskItem[];
  visible: boolean;
  onToggle: () => void;
}

// ── Status icon ───────────────────────────────────────────────────────────────

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'completed') {
    return (
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-[#4ec9b0] text-sm leading-none">
        ✓
      </span>
    );
  }

  if (status === 'in_progress') {
    return (
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
        <span
          className="h-3 w-3 rounded-full border-2 border-[#0e639c] border-t-transparent"
          style={{ animation: 'spin 0.8s linear infinite' }}
        />
      </span>
    );
  }

  // pending
  return (
    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-[#6b6b6b] text-sm leading-none">
      ○
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskList({ tasks, visible, onToggle }: TaskListProps) {
  const { t } = useTranslation();

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const activeTask = tasks.find((t) => t.status === 'in_progress');

  return (
    <div className="fixed bottom-8 right-4 z-40 w-72 rounded-lg border border-[#3e3e42] bg-[#252526] shadow-2xl overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-[#2a2d2e] transition-colors"
        aria-expanded={visible}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#9d9d9d]">
            <path d="M14 1H2L1 2v12l1 1h12l1-1V2l-1-1zM2 14V2h12v12H2zm-1-5h3v-1H1v1zm0 3h3v-1H1v1zm0-6h3V5H1v1zm4 6h8v-1H5v1zm0-3h8V8H5v1zm0-3h8V5H5v1z" />
          </svg>
          <span className="text-xs font-semibold text-[#cccccc]">{t('tasks.title')}</span>
          {totalCount > 0 && (
            <span className="rounded-full bg-[#3e3e42] px-1.5 py-0.5 text-[10px] text-[#9d9d9d]">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
        <span className={`text-[#6b6b6b] transition-transform text-xs ${visible ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Progress bar (always visible) */}
      {totalCount > 0 && (
        <div className="h-0.5 w-full bg-[#3e3e42]">
          <div
            className="h-full bg-[#4ec9b0] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Expanded content */}
      {visible && (
        <div className="flex flex-col">
          {/* Active task highlight */}
          {activeTask && (
            <div className="border-b border-[#3e3e42] bg-[#1a2a3a] px-3 py-2">
              <div className="flex items-center gap-2">
                <TaskStatusIcon status="in_progress" />
                <span className="text-xs font-medium text-[#569cd6]">{activeTask.activeForm}</span>
              </div>
            </div>
          )}

          {/* Task list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {tasks.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[#6b6b6b]">
                {t('tasks.empty')}
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-2 px-3 py-1.5 ${
                    task.status === 'in_progress' ? 'bg-[#1a2a3a]/50' : ''
                  }`}
                >
                  <TaskStatusIcon status={task.status} />
                  <span
                    className={`text-xs leading-5 ${
                      task.status === 'completed'
                        ? 'text-[#6b6b6b] line-through'
                        : task.status === 'in_progress'
                        ? 'text-[#cccccc] font-medium'
                        : 'text-[#9d9d9d]'
                    }`}
                  >
                    {task.status === 'in_progress' ? task.activeForm : task.content}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Footer summary */}
          {totalCount > 0 && (
            <div className="border-t border-[#3e3e42] px-3 py-1.5">
              <span className="text-[10px] text-[#6b6b6b]">
                {completedCount} {t('tasks.of')} {totalCount} {t('tasks.completed')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
