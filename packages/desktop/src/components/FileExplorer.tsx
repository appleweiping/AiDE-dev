import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GitStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'none';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  gitStatus?: GitStatus;
  children?: FileNode[];
}

export interface FileExplorerProps {
  rootPath: string;
  onFileSelect: (path: string) => void;
}

// ── Git status badge ──────────────────────────────────────────────────────────

function GitBadge({ status }: { status: GitStatus }) {
  if (status === 'none') return null;

  const config: Record<GitStatus, { label: string; color: string }> = {
    modified: { label: 'M', color: 'text-[#dcdcaa]' },
    added: { label: 'A', color: 'text-[#4ec9b0]' },
    deleted: { label: 'D', color: 'text-[#f48771]' },
    untracked: { label: 'U', color: 'text-[#9d9d9d]' },
    none: { label: '', color: '' },
  };

  const { label, color } = config[status];
  return <span className={`ml-auto flex-shrink-0 text-[10px] font-bold ${color}`}>{label}</span>;
}

// ── File icon ─────────────────────────────────────────────────────────────────

function FileIcon({ name, type }: { name: string; type: 'file' | 'directory' }) {
  if (type === 'directory') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0 text-[#dcdcaa]">
        <path d="M14.5 3H7.71l-.85-.85L6.5 2h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.5 9H2V3.5l.5-.5H6l.85.85.65.65H14v8z" />
      </svg>
    );
  }

  // Determine icon by extension
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const tsxLike = ['ts', 'tsx', 'js', 'jsx'].includes(ext);
  const jsonLike = ['json', 'yaml', 'yml', 'toml'].includes(ext);
  const styleLike = ['css', 'scss', 'less'].includes(ext);
  const mdLike = ['md', 'mdx', 'txt'].includes(ext);

  const color = tsxLike
    ? 'text-[#569cd6]'
    : jsonLike
    ? 'text-[#dcdcaa]'
    : styleLike
    ? 'text-[#c586c0]'
    : mdLike
    ? 'text-[#9cdcfe]'
    : 'text-[#9d9d9d]';

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={`flex-shrink-0 ${color}`}>
      <path d="M13.71 4.29l-3-3L10 1H4L3 2v12l1 1h9l1-1V5l-.29-.71zM13 14H4V2h5v4h4v8z" />
    </svg>
  );
}

// ── Tree node ─────────────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  onFileSelect,
  filter,
}: {
  node: FileNode;
  depth: number;
  onFileSelect: (path: string) => void;
  filter: string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isDir = node.type === 'directory';

  // Filter: show if name matches or any child matches
  const matchesFilter = useCallback(
    (n: FileNode): boolean => {
      if (!filter) return true;
      if (n.name.toLowerCase().includes(filter.toLowerCase())) return true;
      if (n.children) return n.children.some(matchesFilter);
      return false;
    },
    [filter],
  );

  if (!matchesFilter(node)) return null;

  const visibleChildren = node.children?.filter(matchesFilter) ?? [];

  return (
    <div>
      <button
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-[#2a2d2e] transition-colors group"
        style={{ paddingLeft: `${4 + depth * 12}px` }}
        onClick={() => {
          if (isDir) {
            setExpanded((v) => !v);
          } else {
            onFileSelect(node.path);
          }
        }}
        title={node.path}
      >
        {/* Expand arrow for directories */}
        {isDir ? (
          <span className={`flex-shrink-0 text-[#6b6b6b] text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        <FileIcon name={node.name} type={node.type} />

        <span className="flex-1 truncate text-xs text-[#cccccc]">{node.name}</span>

        <GitBadge status={node.gitStatus ?? 'none'} />
      </button>

      {isDir && expanded && visibleChildren.length > 0 && (
        <div>
          {visibleChildren.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FileExplorer({ rootPath, onFileSelect }: FileExplorerProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);

  // Load file tree via Electron IPC
  useMemo(() => {
    if (!rootPath) return;
    setLoading(true);

    const win = window as Window & {
      electronAPI?: {
        readDirectory?: (path: string) => Promise<FileNode[]>;
      };
    };

    if (win.electronAPI?.readDirectory) {
      win.electronAPI
        .readDirectory(rootPath)
        .then((nodes) => {
          setTree(nodes);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      // Fallback: show placeholder tree for development
      setTree([
        {
          name: 'src',
          path: `${rootPath}/src`,
          type: 'directory',
          children: [
            { name: 'App.tsx', path: `${rootPath}/src/App.tsx`, type: 'file', gitStatus: 'modified' },
            { name: 'main.tsx', path: `${rootPath}/src/main.tsx`, type: 'file', gitStatus: 'none' },
            {
              name: 'components',
              path: `${rootPath}/src/components`,
              type: 'directory',
              children: [
                { name: 'Chat.tsx', path: `${rootPath}/src/components/Chat.tsx`, type: 'file', gitStatus: 'none' },
                { name: 'Settings.tsx', path: `${rootPath}/src/components/Settings.tsx`, type: 'file', gitStatus: 'added' },
              ],
            },
          ],
        },
        { name: 'package.json', path: `${rootPath}/package.json`, type: 'file', gitStatus: 'none' },
        { name: 'tsconfig.json', path: `${rootPath}/tsconfig.json`, type: 'file', gitStatus: 'none' },
      ]);
      setLoading(false);
    }
  }, [rootPath]);

  const rootName = rootPath.split(/[\\/]/).pop() ?? rootPath;

  return (
    <div className="flex h-full flex-col bg-[#252526]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3e3e42] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#9d9d9d]">
          {t('fileExplorer.title')}
        </span>
        <span className="truncate text-[10px] text-[#6b6b6b] max-w-[120px]" title={rootPath}>
          {rootName}
        </span>
      </div>

      {/* Search */}
      <div className="border-b border-[#3e3e42] px-2 py-1.5">
        <div className="flex items-center gap-1.5 rounded bg-[#3e3e42] px-2 py-1">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0 text-[#6b6b6b]">
            <path d="M15.7 13.3l-3.81-3.83A5.93 5.93 0 0 0 13 6c0-3.31-2.69-6-6-6S1 2.69 1 6s2.69 6 6 6c1.3 0 2.48-.41 3.47-1.11l3.83 3.81c.19.2.45.3.7.3.25 0 .52-.09.7-.3a.99.99 0 0 0 0-1.41zM7 11c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
          </svg>
          <input
            type="text"
            className="flex-1 bg-transparent text-xs text-[#cccccc] placeholder-[#6b6b6b] outline-none"
            placeholder={t('fileExplorer.search')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="text-[#6b6b6b] hover:text-[#cccccc] transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-4 text-center text-xs text-[#6b6b6b]">
            {t('fileExplorer.loading')}
          </div>
        ) : tree.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-[#6b6b6b]">
            {t('fileExplorer.empty')}
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              onFileSelect={onFileSelect}
              filter={filter}
            />
          ))
        )}
      </div>

      {/* Git legend */}
      <div className="flex items-center gap-3 border-t border-[#3e3e42] px-3 py-1.5">
        <span className="text-[10px] text-[#dcdcaa]">M {t('fileExplorer.git.modified')}</span>
        <span className="text-[10px] text-[#4ec9b0]">A {t('fileExplorer.git.added')}</span>
        <span className="text-[10px] text-[#f48771]">D {t('fileExplorer.git.deleted')}</span>
      </div>
    </div>
  );
}
