import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentStore } from './stores/agent';
import { useAgent } from './hooks/useAgent';
import Chat from './components/Chat';
import SessionList from './components/SessionList';
import Settings from './components/Settings';
import ApprovalDialog from './components/ApprovalDialog';
import CommandPalette from './components/CommandPalette';
import TaskList from './components/TaskList';
import Terminal from './components/Terminal';
import FileExplorer from './components/FileExplorer';
import TokenUsage from './components/TokenUsage';
import type { TaskItem } from './components/TaskList';

// ── Token usage aggregation ───────────────────────────────────────────────────

function useTotalTokens() {
  const messages = useAgentStore((s) => s.messages);
  let inputTokens = 0;
  let outputTokens = 0;
  for (const msg of messages) {
    if (msg.role === 'user') {
      inputTokens += Math.ceil(msg.content.length / 4);
    } else if (msg.role === 'assistant') {
      outputTokens += Math.ceil(msg.content.length / 4);
    }
  }
  return { inputTokens, outputTokens };
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showTaskList, setShowTaskList] = useState(true);
  const [tasks] = useState<TaskItem[]>([]);
  const pendingApproval = useAgentStore((s) => s.pendingApproval);
  const { inputTokens, outputTokens } = useTotalTokens();

  // Mount the event bridge once at the root
  useAgent();

  // Ctrl+Shift+P → command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      }
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setShowTerminal((v) => !v);
      }
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setShowFileExplorer((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleCommand = useCallback((cmd: string) => {
    switch (cmd) {
      case 'settings.open':
        setShowSettings(true);
        break;
      case 'tools.toggleTerminal':
        setShowTerminal((v) => !v);
        break;
      case 'tools.toggleFileExplorer':
        setShowFileExplorer((v) => !v);
        break;
      case 'tools.toggleTaskList':
        setShowTaskList((v) => !v);
        break;
      case 'session.new': {
        const store = useAgentStore.getState();
        store.clearMessages();
        store.setCurrentSession(null);
        break;
      }
      case 'session.clear':
        useAgentStore.getState().clearMessages();
        break;
      default:
        break;
    }
  }, []);

  // Derive model from settings (fallback to a sensible default)
  const model = (window as Window & { __aideModel?: string }).__aideModel ?? 'claude-sonnet-4-6';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#1e1e1e] text-[#cccccc]">
      {/* ── Main layout row ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* File explorer sidebar */}
        {showFileExplorer && (
          <aside className="flex w-52 flex-shrink-0 flex-col border-r border-[#3e3e42]">
            <FileExplorer
              rootPath={(window as Window & { __aideWorkDir?: string }).__aideWorkDir ?? '.'}
              onFileSelect={(path) => {
                // Emit to chat as a file reference
                const event = new CustomEvent('aide:file-select', { detail: { path } });
                window.dispatchEvent(event);
              }}
            />
          </aside>
        )}

        {/* Session sidebar */}
        <aside className="flex w-56 flex-shrink-0 flex-col border-r border-[#3e3e42] bg-[#252526]">
          <div className="flex items-center justify-between border-b border-[#3e3e42] px-3 py-2">
            <span className="text-sm font-semibold tracking-wide text-[#cccccc]">
              {t('app.title')}
            </span>
            <div className="flex items-center gap-1">
              {/* File explorer toggle */}
              <button
                onClick={() => setShowFileExplorer((v) => !v)}
                className={`rounded p-1 transition-colors ${
                  showFileExplorer
                    ? 'bg-[#0e639c] text-white'
                    : 'text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc]'
                }`}
                title={t('fileExplorer.title') + ' (Ctrl+B)'}
                aria-label={t('fileExplorer.title')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M14.5 3H7.71l-.85-.85L6.5 2h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.5 9H2V3.5l.5-.5H6l.85.85.65.65H14v8z" />
                </svg>
              </button>

              {/* Command palette button */}
              <button
                onClick={() => setShowCommandPalette(true)}
                className="rounded p-1 text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors"
                title={t('commandPalette.title') + ' (Ctrl+Shift+P)'}
                aria-label={t('commandPalette.title')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 3l4 4-4 4M8 11h5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Settings button */}
              <button
                onClick={() => setShowSettings(true)}
                className="rounded p-1 text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors"
                title={t('sidebar.settings')}
                aria-label={t('sidebar.settings')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M9.1 4.4L8.1 2H7l-1 2.4-.3.1-2-1.3-.7.7 1.3 2-.1.3L2 7v1l2.4 1 .1.3-1.3 2 .7.7 2-1.3.3.1L7 13h1l1-2.4.3-.1 2 1.3.7-.7-1.3-2 .1-.3L13 8V7l-2.4-1-.1-.3 1.3-2-.7-.7-2 1.3-.3-.2zM8 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
                </svg>
              </button>
            </div>
          </div>
          <SessionList />
        </aside>

        {/* Main area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <Chat />
        </main>
      </div>

      {/* ── Terminal panel (bottom) ── */}
      {showTerminal && (
        <div className="flex h-48 flex-shrink-0 flex-col border-t border-[#3e3e42]">
          <Terminal visible={showTerminal} />
        </div>
      )}

      {/* ── Status bar ── */}
      <div className="flex h-6 flex-shrink-0 items-center justify-between border-t border-[#3e3e42] bg-[#007acc] px-3">
        <div className="flex items-center gap-3">
          {/* Terminal toggle */}
          <button
            onClick={() => setShowTerminal((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-white/80 hover:text-white transition-colors"
            title={t('terminal.title') + ' (Ctrl+`)'}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 9L1 4l1-1 4 4 4-4 1 1-5 5zm4 4H1v-1h9v1z" />
            </svg>
            {t('terminal.title')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Token usage */}
          <div className="text-white/80">
            <TokenUsage
              inputTokens={inputTokens}
              outputTokens={outputTokens}
              model={model}
            />
          </div>
        </div>
      </div>

      {/* ── Floating task list ── */}
      {tasks.length > 0 && (
        <TaskList
          tasks={tasks}
          visible={showTaskList}
          onToggle={() => setShowTaskList((v) => !v)}
        />
      )}

      {/* ── Modals & overlays ── */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {pendingApproval && <ApprovalDialog />}
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onCommand={handleCommand}
      />
    </div>
  );
}
