import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Worktree {
  id: string;
  name: string;
  branch: string;
  path: string;
  isMain: boolean;
  uncommittedChanges: number;
  status: 'clean' | 'dirty' | 'conflict';
}

const MOCK_BRANCHES = ['main', 'feat/mcp-manager', 'feat/git-panel', 'fix/streaming-bug', 'feat/rag-panel'];

const INITIAL_WORKTREES: Worktree[] = [
  {
    id: 'main',
    name: 'main',
    branch: 'main',
    path: 'D:/devtools/aide',
    isMain: true,
    uncommittedChanges: 0,
    status: 'clean',
  },
  {
    id: 'wt-1',
    name: 'feat-mcp',
    branch: 'feat/mcp-manager',
    path: 'D:/devtools/aide/.worktrees/feat-mcp',
    isMain: false,
    uncommittedChanges: 3,
    status: 'dirty',
  },
];

export default function WorktreePanel() {
  const { t } = useTranslation();
  const [worktrees, setWorktrees] = useState<Worktree[]>(INITIAL_WORKTREES);
  const [activeId, setActiveId] = useState('main');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBranch, setNewBranch] = useState(MOCK_BRANCHES[0]);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    await new Promise((r) => setTimeout(r, 800));
    const wt: Worktree = {
      id: `wt-${Date.now()}`,
      name: newName.trim(),
      branch: newBranch,
      path: `D:/devtools/aide/.worktrees/${newName.trim()}`,
      isMain: false,
      uncommittedChanges: 0,
      status: 'clean',
    };
    setWorktrees((prev) => [...prev, wt]);
    setActiveId(wt.id);
    setNewName('');
    setShowCreateForm(false);
    setCreating(false);
  }

  function handleRemove(id: string) {
    setWorktrees((prev) => prev.filter((w) => w.id !== id));
    if (activeId === id) setActiveId('main');
    setConfirmRemoveId(null);
  }

  function statusColor(status: Worktree['status']) {
    switch (status) {
      case 'clean': return 'text-[#4ec9b0]';
      case 'dirty': return 'text-[#dcdcaa]';
      case 'conflict': return 'text-[#f44747]';
    }
  }

  function statusDot(status: Worktree['status']) {
    switch (status) {
      case 'clean': return 'bg-[#4ec9b0]';
      case 'dirty': return 'bg-[#dcdcaa]';
      case 'conflict': return 'bg-[#f44747]';
    }
  }

  function statusLabel(wt: Worktree) {
    if (wt.status === 'clean') return t('worktree.clean');
    if (wt.status === 'conflict') return t('worktree.conflict');
    return `${wt.uncommittedChanges} ${t('worktree.changes')}`;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#252526]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3e3e42] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">
          {t('worktree.title')}
        </span>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="rounded border border-[#3e3e42] bg-[#0e639c] px-2 py-0.5 text-xs text-white hover:bg-[#1177bb] transition-colors"
        >
          + {t('worktree.new')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Create form */}
        {showCreateForm && (
          <div className="border-b border-[#3e3e42] bg-[#2d2d30] px-3 py-3 space-y-2">
            <p className="text-xs font-semibold text-[#cccccc]">{t('worktree.createNew')}</p>
            <div>
              <label className="mb-1 block text-xs text-[#9d9d9d]">{t('worktree.name')}</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="feat-my-feature"
                className="w-full rounded border border-[#3e3e42] bg-[#252526] px-2 py-1.5 text-xs text-[#cccccc] placeholder-[#6b6b6b] outline-none focus:border-[#0e639c]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#9d9d9d]">{t('worktree.baseBranch')}</label>
              <select
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                className="w-full rounded border border-[#3e3e42] bg-[#252526] px-2 py-1.5 text-xs text-[#cccccc] outline-none focus:border-[#0e639c]"
              >
                {MOCK_BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="flex items-center gap-1.5 rounded bg-[#0e639c] px-3 py-1.5 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50 transition-colors"
              >
                {creating && <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white border-t-transparent" />}
                {t('worktree.create')}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded border border-[#3e3e42] px-3 py-1.5 text-xs text-[#9d9d9d] hover:bg-[#3e3e42] transition-colors"
              >
                {t('settings.close')}
              </button>
            </div>
          </div>
        )}

        {/* Worktree list */}
        {worktrees.map((wt) => (
          <div
            key={wt.id}
            className={`border-b border-[#3e3e42] ${activeId === wt.id ? 'bg-[#2a2d2e]' : 'hover:bg-[#2a2d2e]'}`}
          >
            <div className="flex items-start gap-2 px-3 py-2.5">
              <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${statusDot(wt.status)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#cccccc] truncate">{wt.name}</span>
                  {wt.isMain && (
                    <span className="rounded bg-[#3e3e42] px-1 py-0.5 text-xs text-[#9d9d9d]">
                      {t('worktree.main')}
                    </span>
                  )}
                  {activeId === wt.id && (
                    <span className="rounded bg-[#0e639c]/20 px-1 py-0.5 text-xs text-[#4fc1ff]">
                      {t('worktree.active')}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-[#6b6b6b]">
                    <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM4.25 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z" />
                  </svg>
                  <span className="text-xs text-[#9d9d9d] truncate">{wt.branch}</span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-[#6b6b6b] truncate">{wt.path}</p>
                <p className={`mt-0.5 text-xs ${statusColor(wt.status)}`}>{statusLabel(wt)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1 border-t border-[#3e3e42]/50 px-3 py-1.5">
              {activeId !== wt.id && (
                <button
                  onClick={() => setActiveId(wt.id)}
                  className="rounded border border-[#3e3e42] px-2 py-0.5 text-xs text-[#9d9d9d] hover:bg-[#3e3e42] hover:text-[#cccccc] transition-colors"
                >
                  {t('worktree.switch')}
                </button>
              )}
              {!wt.isMain && (
                <button
                  onClick={() => setConfirmRemoveId(wt.id)}
                  className="rounded border border-[#f44747]/30 px-2 py-0.5 text-xs text-[#f44747] hover:bg-[#f44747]/10 transition-colors"
                >
                  {t('worktree.remove')}
                </button>
              )}
            </div>
          </div>
        ))}

        {worktrees.length === 0 && (
          <p className="px-3 py-4 text-xs text-[#6b6b6b]">{t('worktree.empty')}</p>
        )}
      </div>

      {/* Confirm remove dialog */}
      {confirmRemoveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-lg border border-[#3e3e42] bg-[#252526] p-4 shadow-2xl w-72">
            <p className="text-sm font-semibold text-[#cccccc]">{t('worktree.confirmRemoveTitle')}</p>
            <p className="mt-1 text-xs text-[#9d9d9d]">
              {t('worktree.confirmRemoveDesc', {
                name: worktrees.find((w) => w.id === confirmRemoveId)?.name ?? '',
              })}
            </p>
            <div className="mt-3 flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRemoveId(null)}
                className="rounded border border-[#3e3e42] px-3 py-1.5 text-xs text-[#9d9d9d] hover:bg-[#2a2d2e] transition-colors"
              >
                {t('worktree.cancel')}
              </button>
              <button
                onClick={() => handleRemove(confirmRemoveId)}
                className="rounded bg-[#f44747] px-3 py-1.5 text-xs text-white hover:bg-red-500 transition-colors"
              >
                {t('worktree.remove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
