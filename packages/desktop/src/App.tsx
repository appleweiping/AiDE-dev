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
import McpManager from './components/McpManager';
import GitPanel from './components/GitPanel';
import SubAgentPanel from './components/SubAgentPanel';
import UpdateNotification from './components/UpdateNotification';
import PluginMarketplace from './components/PluginMarketplace';
import SessionTabs from './components/SessionTabs';
import RagPanel from './components/RagPanel';
import WorktreePanel from './components/WorktreePanel';
import type { TaskItem } from './components/TaskList';
import type { SessionTab } from './components/SessionTabs';

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

// ── Sidebar tab type ──────────────────────────────────────────────────────────

type SidebarTab = 'sessions' | 'git' | 'subagents' | 'rag' | 'worktrees';

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showTaskList, setShowTaskList] = useState(true);
  const [showMcpManager, setShowMcpManager] = useState(false);
  const [showPluginMarketplace, setShowPluginMarketplace] = useState(false);
  const [tasks] = useState<TaskItem[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('sessions');
  const pendingApproval = useAgentStore((s) => s.pendingApproval);
  const { inputTokens, outputTokens } = useTotalTokens();

  // Session tabs state
  const [sessionTabs, setSessionTabs] = useState<SessionTab[]>([
    { id: 'default', title: t('tabs.defaultTitle'), hasUnsavedChanges: false },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('default');

  // Demo update notification
  const [showUpdate, setShowUpdate] = useState(true);

  // Mount the event bridge once at the root
  useAgent();

  // Keyboard shortcuts
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
      // Ctrl+T → new tab
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        handleNewTab();
      }
      // Ctrl+W → close active tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) handleCloseTab(activeTabId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  // Tab management
  function handleNewTab() {
    const id = crypto.randomUUID();
    const title = `${t('tabs.newTabTitle')} ${sessionTabs.length + 1}`;
    setSessionTabs((prev) => [...prev, { id, title, hasUnsavedChanges: false }]);
    setActiveTabId(id);
    const store = useAgentStore.getState();
    store.clearMessages();
    store.setCurrentSession(null);
  }

  function handleCloseTab(id: string) {
    setSessionTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        // Always keep at least one tab
        const newTab: SessionTab = { id: crypto.randomUUID(), title: t('tabs.defaultTitle'), hasUnsavedChanges: false };
        setActiveTabId(newTab.id);
        return [newTab];
      }
      if (activeTabId === id) {
        const idx = prev.findIndex((t) => t.id === id);
        const next = remaining[Math.max(0, idx - 1)];
        setActiveTabId(next.id);
      }
      return remaining;
    });
  }

  function handleRenameTab(id: string, title: string) {
    setSessionTabs((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
  }

  function handleDuplicateTab(id: string) {
    const source = sessionTabs.find((t) => t.id === id);
    if (!source) return;
    const newId = crypto.randomUUID();
    setSessionTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const copy: SessionTab = { id: newId, title: `${source.title} (2)`, hasUnsavedChanges: false };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setActiveTabId(newId);
  }

  function handleCloseOthers(id: string) {
    setSessionTabs((prev) => prev.filter((t) => t.id === id));
    setActiveTabId(id);
  }

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
      case 'tools.openMcp':
        setShowMcpManager(true);
        break;
      case 'tools.openPlugins':
        setShowPluginMarketplace(true);
        break;
      case 'session.new':
        handleNewTab();
        break;
      case 'session.clear':
        useAgentStore.getState().clearMessages();
        break;
      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const model = (window as Window & { __aideModel?: string }).__aideModel ?? 'claude-sonnet-4-6';

  // Sidebar tab icon helper
  function SidebarTabButton({
    id,
    icon,
    label,
  }: {
    id: SidebarTab;
    icon: React.ReactNode;
    label: string;
  }) {
    return (
      <button
        onClick={() => setSidebarTab(id)}
        title={label}
        aria-label={label}
        className={`flex items-center justify-center rounded p-1.5 transition-colors ${
          sidebarTab === id
            ? 'bg-[#0e639c] text-white'
            : 'text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc]'
        }`}
      >
        {icon}
      </button>
    );
  }

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
                const event = new CustomEvent('aide:file-select', { detail: { path } });
                window.dispatchEvent(event);
              }}
            />
          </aside>
        )}

        {/* Session sidebar */}
        <aside className="flex w-56 flex-shrink-0 flex-col border-r border-[#3e3e42] bg-[#252526]">
          {/* Sidebar header */}
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

              {/* MCP Manager button */}
              <button
                onClick={() => setShowMcpManager(true)}
                className="rounded p-1 text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors"
                title={t('mcp.title')}
                aria-label={t('mcp.title')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM7 5v2H5v2h2v2h2V9h2V7H9V5H7z" />
                </svg>
              </button>

              {/* Plugin Marketplace button */}
              <button
                onClick={() => setShowPluginMarketplace(true)}
                className="rounded p-1 text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors"
                title={t('plugin.title')}
                aria-label={t('plugin.title')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z" />
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

          {/* Sidebar tab bar */}
          <div className="flex items-center gap-0.5 border-b border-[#3e3e42] px-2 py-1.5">
            <SidebarTabButton
              id="sessions"
              label={t('sidebar.sessions')}
              icon={
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M14 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4l2 2 2-2h4a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" />
                </svg>
              }
            />
            <SidebarTabButton
              id="git"
              label={t('git.title')}
              icon={
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM4.25 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z" />
                </svg>
              }
            />
            <SidebarTabButton
              id="subagents"
              label={t('subAgent.title')}
              icon={
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a3 3 0 1 0 0 6A3 3 0 0 0 8 1zM3 8a5 5 0 0 1 10 0v1H3V8zm-1 2h12v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1z" />
                </svg>
              }
            />
            <SidebarTabButton
              id="rag"
              label={t('rag.title')}
              icon={
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
                </svg>
              }
            />
            <SidebarTabButton
              id="worktrees"
              label={t('worktree.title')}
              icon={
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 2h4v4H2V2zm8 0h4v4h-4V2zM2 10h4v4H2v-4zm8 0h4v4h-4v-4z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              }
            />
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'sessions' && <SessionList />}
            {sidebarTab === 'git' && <GitPanel />}
            {sidebarTab === 'subagents' && <SubAgentPanel />}
            {sidebarTab === 'rag' && <RagPanel />}
            {sidebarTab === 'worktrees' && <WorktreePanel />}
          </div>
        </aside>

        {/* Main area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Session tabs */}
          <SessionTabs
            tabs={sessionTabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onNewTab={handleNewTab}
            onCloseTab={handleCloseTab}
            onRenameTab={handleRenameTab}
            onDuplicateTab={handleDuplicateTab}
            onCloseOthers={handleCloseOthers}
          />
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

      {/* ── Update notification ── */}
      {showUpdate && (
        <UpdateNotification
          update={{
            currentVersion: '0.3.1',
            newVersion: '0.4.0',
            releaseNotes: '- Phase 2 & 3 UI components\n- MCP Manager\n- Git Panel\n- Sub-Agent Panel\n- Plugin Marketplace\n- Session Tabs\n- RAG Panel\n- Worktree Panel',
            downloadUrl: 'https://github.com/aide/aide/releases/latest',
          }}
          onDismiss={() => setShowUpdate(false)}
          onSkipVersion={() => setShowUpdate(false)}
        />
      )}

      {/* ── Modals & overlays ── */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showMcpManager && <McpManager onClose={() => setShowMcpManager(false)} />}
      {showPluginMarketplace && <PluginMarketplace onClose={() => setShowPluginMarketplace(false)} />}
      {pendingApproval && <ApprovalDialog />}
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onCommand={handleCommand}
      />
    </div>
  );
}
