import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface GitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
}

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

const MOCK_FILES: GitFile[] = [
  { path: 'src/App.tsx', status: 'modified', staged: true },
  { path: 'src/components/Chat.tsx', status: 'modified', staged: false },
  { path: 'src/components/GitPanel.tsx', status: 'added', staged: false },
  { path: 'src/stores/agent.ts', status: 'modified', staged: false },
  { path: 'old-file.ts', status: 'deleted', staged: true },
];

const MOCK_COMMITS: GitCommit[] = [
  { hash: 'a1b2c3d', message: 'feat: add MCP manager UI', author: 'dev', date: '2 hours ago' },
  { hash: 'e4f5g6h', message: 'fix: streaming state reset on cancel', author: 'dev', date: '5 hours ago' },
  { hash: 'i7j8k9l', message: 'chore: update dependencies', author: 'dev', date: '1 day ago' },
  { hash: 'm1n2o3p', message: 'feat: add approval dialog', author: 'dev', date: '2 days ago' },
  { hash: 'q4r5s6t', message: 'refactor: extract useTauri hook', author: 'dev', date: '3 days ago' },
  { hash: 'u7v8w9x', message: 'docs: update README', author: 'dev', date: '4 days ago' },
  { hash: 'y1z2a3b', message: 'feat: add settings panel', author: 'dev', date: '5 days ago' },
  { hash: 'c4d5e6f', message: 'init: project scaffold', author: 'dev', date: '1 week ago' },
];

const MOCK_BRANCHES = ['main', 'feat/mcp-manager', 'feat/git-panel', 'fix/streaming-bug'];

export default function GitPanel() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<GitFile[]>(MOCK_FILES);
  const [currentBranch, setCurrentBranch] = useState('feat/mcp-manager');
  const [commitMessage, setCommitMessage] = useState('');
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showCommits, setShowCommits] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);

  function handleStage(path: string) {
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, staged: true } : f)));
  }

  function handleUnstage(path: string) {
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, staged: false } : f)));
  }

  function handleStageAll() {
    setFiles((prev) => prev.map((f) => ({ ...f, staged: true })));
  }

  function handleUnstageAll() {
    setFiles((prev) => prev.map((f) => ({ ...f, staged: false })));
  }

  function handleCommit() {
    if (!commitMessage.trim() || stagedFiles.length === 0) return;
    setFiles((prev) => prev.filter((f) => !f.staged));
    setCommitMessage('');
  }

  async function handlePush() {
    setIsPushing(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsPushing(false);
    setPushStatus('ok');
    setTimeout(() => setPushStatus('idle'), 3000);
  }

  async function handlePull() {
    setIsPulling(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsPulling(false);
  }

  function fileStatusColor(status: GitFile['status']) {
    switch (status) {
      case 'added': return 'text-[#4ec9b0]';
      case 'deleted': return 'text-[#f44747]';
      case 'modified': return 'text-[#dcdcaa]';
      case 'renamed': return 'text-[#4fc1ff]';
      default: return 'text-[#9d9d9d]';
    }
  }

  function fileStatusBadge(status: GitFile['status']) {
    switch (status) {
      case 'added': return 'A';
      case 'deleted': return 'D';
      case 'modified': return 'M';
      case 'renamed': return 'R';
      default: return 'U';
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#252526]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3e3e42] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">
          {t('git.title')}
        </span>
        <div className="flex items-center gap-1">
          {/* Pull */}
          <button
            onClick={handlePull}
            disabled={isPulling}
            title={t('git.pull')}
            className="rounded p-1 text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc] disabled:opacity-50 transition-colors"
          >
            {isPulling ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent block" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 12L3 7l1-1 3.5 3.5V2h1v7.5L12 6l1 1-5 5z" />
              </svg>
            )}
          </button>
          {/* Push */}
          <button
            onClick={handlePush}
            disabled={isPushing}
            title={t('git.push')}
            className={`rounded p-1 transition-colors disabled:opacity-50 ${
              pushStatus === 'ok' ? 'text-[#4ec9b0]' : pushStatus === 'error' ? 'text-[#f44747]' : 'text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc]'
            }`}
          >
            {isPushing ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent block" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4L3 9l1 1 3.5-3.5V14h1V6.5L12 10l1-1-5-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Branch switcher */}
        <div className="relative border-b border-[#3e3e42] px-3 py-2">
          <button
            onClick={() => setShowBranchDropdown((v) => !v)}
            className="flex w-full items-center gap-2 rounded border border-[#3e3e42] bg-[#2d2d30] px-2 py-1.5 text-xs text-[#cccccc] hover:border-[#555] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM4.25 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z" />
            </svg>
            <span className="flex-1 truncate text-left">{currentBranch}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M2 3l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          {showBranchDropdown && (
            <div className="absolute left-3 right-3 top-full z-10 mt-1 rounded border border-[#3e3e42] bg-[#2d2d30] shadow-lg">
              {MOCK_BRANCHES.map((branch) => (
                <button
                  key={branch}
                  onClick={() => { setCurrentBranch(branch); setShowBranchDropdown(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                    branch === currentBranch ? 'text-[#4fc1ff]' : 'text-[#cccccc] hover:bg-[#3e3e42]'
                  }`}
                >
                  {branch === currentBranch && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    </svg>
                  )}
                  <span className={branch === currentBranch ? '' : 'ml-[14px]'}>{branch}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Staged files */}
        <div className="border-b border-[#3e3e42]">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-semibold text-[#9d9d9d]">
              {t('git.staged')} ({stagedFiles.length})
            </span>
            {stagedFiles.length > 0 && (
              <button
                onClick={handleUnstageAll}
                className="text-xs text-[#6b6b6b] hover:text-[#9d9d9d] transition-colors"
              >
                {t('git.unstageAll')}
              </button>
            )}
          </div>
          {stagedFiles.map((file) => (
            <div
              key={file.path}
              className="group flex items-center gap-2 px-3 py-1 hover:bg-[#2a2d2e]"
            >
              <span className={`w-3 text-center text-xs font-bold ${fileStatusColor(file.status)}`}>
                {fileStatusBadge(file.status)}
              </span>
              <span className="flex-1 truncate text-xs text-[#cccccc]">{file.path}</span>
              <button
                onClick={() => handleUnstage(file.path)}
                className="hidden text-xs text-[#6b6b6b] hover:text-[#cccccc] group-hover:block transition-colors"
                title={t('git.unstage')}
              >
                −
              </button>
            </div>
          ))}
        </div>

        {/* Unstaged files */}
        <div className="border-b border-[#3e3e42]">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-semibold text-[#9d9d9d]">
              {t('git.changes')} ({unstagedFiles.length})
            </span>
            {unstagedFiles.length > 0 && (
              <button
                onClick={handleStageAll}
                className="text-xs text-[#6b6b6b] hover:text-[#9d9d9d] transition-colors"
              >
                {t('git.stageAll')}
              </button>
            )}
          </div>
          {unstagedFiles.map((file) => (
            <div
              key={file.path}
              className="group flex items-center gap-2 px-3 py-1 hover:bg-[#2a2d2e]"
            >
              <span className={`w-3 text-center text-xs font-bold ${fileStatusColor(file.status)}`}>
                {fileStatusBadge(file.status)}
              </span>
              <span className="flex-1 truncate text-xs text-[#cccccc]">{file.path}</span>
              <button
                onClick={() => handleStage(file.path)}
                className="hidden text-xs text-[#6b6b6b] hover:text-[#cccccc] group-hover:block transition-colors"
                title={t('git.stage')}
              >
                +
              </button>
            </div>
          ))}
          {unstagedFiles.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#6b6b6b]">{t('git.noChanges')}</p>
          )}
        </div>

        {/* Commit form */}
        <div className="border-b border-[#3e3e42] px-3 py-2 space-y-2">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder={t('git.commitPlaceholder')}
            rows={2}
            className="w-full resize-none rounded border border-[#3e3e42] bg-[#2d2d30] px-2 py-1.5 text-xs text-[#cccccc] placeholder-[#6b6b6b] outline-none focus:border-[#0e639c]"
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || stagedFiles.length === 0}
            className="w-full rounded bg-[#0e639c] py-1.5 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50 transition-colors"
          >
            {t('git.commit')} {stagedFiles.length > 0 && `(${stagedFiles.length})`}
          </button>
        </div>

        {/* Recent commits */}
        <div>
          <button
            onClick={() => setShowCommits((v) => !v)}
            className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#9d9d9d] hover:bg-[#2a2d2e] transition-colors"
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
              className={`transition-transform ${showCommits ? 'rotate-90' : ''}`}
            >
              <path d="M3 2l4 3-4 3V2z" />
            </svg>
            {t('git.recentCommits')}
          </button>
          {showCommits && (
            <div className="space-y-0">
              {MOCK_COMMITS.map((commit) => (
                <div key={commit.hash} className="border-b border-[#3e3e42]/50 px-3 py-2 hover:bg-[#2a2d2e]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#6b6b6b]">{commit.hash}</span>
                    <span className="ml-auto text-xs text-[#6b6b6b]">{commit.date}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#cccccc] truncate">{commit.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
