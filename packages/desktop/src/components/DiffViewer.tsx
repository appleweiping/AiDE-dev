import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

interface Hunk {
  lines: DiffLine[];
  startOld: number;
  startNew: number;
  collapsed: boolean;
}

export interface DiffViewerProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  onAccept: () => void;
  onReject: () => void;
}

// ── Diff computation ──────────────────────────────────────────────────────────

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  let oldLineNo = m;
  let newLineNo = n;

  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({
        type: 'unchanged',
        content: oldLines[i - 1],
        oldLineNo: i,
        newLineNo: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({
        type: 'added',
        content: newLines[j - 1],
        oldLineNo: null,
        newLineNo: j,
      });
      j--;
    } else {
      stack.push({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNo: i,
        newLineNo: null,
      });
      i--;
    }
  }

  return stack.reverse();
}

function buildHunks(lines: DiffLine[], contextLines = 3): Hunk[] {
  const hunks: Hunk[] = [];
  const changed = new Set<number>();

  lines.forEach((line, idx) => {
    if (line.type !== 'unchanged') {
      for (let k = Math.max(0, idx - contextLines); k <= Math.min(lines.length - 1, idx + contextLines); k++) {
        changed.add(k);
      }
    }
  });

  let currentHunk: DiffLine[] | null = null;
  let startOld = 1;
  let startNew = 1;

  lines.forEach((line, idx) => {
    if (changed.has(idx)) {
      if (!currentHunk) {
        currentHunk = [];
        startOld = line.oldLineNo ?? 1;
        startNew = line.newLineNo ?? 1;
      }
      currentHunk.push(line);
    } else {
      if (currentHunk) {
        hunks.push({ lines: currentHunk, startOld, startNew, collapsed: false });
        currentHunk = null;
      }
    }
  });

  if (currentHunk) {
    hunks.push({ lines: currentHunk, startOld, startNew, collapsed: false });
  }

  return hunks;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DiffLineRow({ line }: { line: DiffLine }) {
  const bgClass =
    line.type === 'added'
      ? 'bg-[#1a3a1a] hover:bg-[#1e4a1e]'
      : line.type === 'removed'
      ? 'bg-[#3a1a1a] hover:bg-[#4a1e1e]'
      : 'hover:bg-[#2a2d2e]';

  const textClass =
    line.type === 'added'
      ? 'text-[#4ec9b0]'
      : line.type === 'removed'
      ? 'text-[#f48771]'
      : 'text-[#cccccc]';

  const prefix =
    line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

  return (
    <div className={`flex font-mono text-xs ${bgClass}`}>
      {/* Old line number */}
      <span className="w-10 flex-shrink-0 select-none border-r border-[#3e3e42] px-1 text-right text-[#6b6b6b]">
        {line.oldLineNo ?? ''}
      </span>
      {/* New line number */}
      <span className="w-10 flex-shrink-0 select-none border-r border-[#3e3e42] px-1 text-right text-[#6b6b6b]">
        {line.newLineNo ?? ''}
      </span>
      {/* Prefix */}
      <span className={`w-5 flex-shrink-0 select-none px-1 ${textClass}`}>{prefix}</span>
      {/* Content */}
      <span className={`flex-1 whitespace-pre px-1 ${textClass}`}>{line.content}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DiffViewer({ filePath, oldContent, newContent, onAccept, onReject }: DiffViewerProps) {
  const { t } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState(newContent);
  const [hunkStates, setHunkStates] = useState<boolean[]>([]);

  const diffLines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);
  const hunks = useMemo(() => buildHunks(diffLines), [diffLines]);

  const addedCount = diffLines.filter((l) => l.type === 'added').length;
  const removedCount = diffLines.filter((l) => l.type === 'removed').length;

  const toggleHunk = (idx: number) => {
    setHunkStates((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const isCollapsed = (idx: number) => hunkStates[idx] ?? false;

  return (
    <div className="flex flex-col rounded border border-[#3e3e42] bg-[#1e1e1e] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3e3e42] bg-[#252526] px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0 text-[#9d9d9d]">
            <path d="M13.71 4.29l-3-3L10 1H4L3 2v12l1 1h9l1-1V5l-.29-.71zM13 14H4V2h5v4h4v8z" />
          </svg>
          <span className="truncate font-mono text-xs text-[#cccccc]">{filePath}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-xs text-[#4ec9b0]">+{addedCount}</span>
          <span className="text-xs text-[#f48771]">-{removedCount}</span>
        </div>
      </div>

      {/* Diff body or edit mode */}
      {editMode ? (
        <div className="flex flex-col">
          <textarea
            className="min-h-[300px] resize-y bg-[#1e1e1e] p-3 font-mono text-xs text-[#cccccc] outline-none"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          {hunks.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#6b6b6b]">
              {t('diff.noChanges')}
            </div>
          ) : (
            hunks.map((hunk, hunkIdx) => (
              <div key={hunkIdx} className="border-b border-[#3e3e42] last:border-b-0">
                {/* Hunk header */}
                <button
                  onClick={() => toggleHunk(hunkIdx)}
                  className="flex w-full items-center gap-2 bg-[#252526] px-3 py-1 text-left text-xs text-[#6b6b6b] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors"
                >
                  <span className={`transition-transform ${isCollapsed(hunkIdx) ? '' : 'rotate-90'}`}>▶</span>
                  <span>
                    @@ -{hunk.startOld} +{hunk.startNew} @@
                  </span>
                </button>

                {/* Hunk lines */}
                {!isCollapsed(hunkIdx) && (
                  <div>
                    {hunk.lines.map((line, lineIdx) => (
                      <DiffLineRow key={lineIdx} line={line} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-[#3e3e42] bg-[#252526] px-3 py-2">
        <button
          onClick={() => setEditMode((v) => !v)}
          className="rounded px-3 py-1 text-xs text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors border border-[#3e3e42]"
        >
          {editMode ? t('diff.viewDiff') : t('diff.edit')}
        </button>
        <button
          onClick={onReject}
          className="rounded px-3 py-1 text-xs text-[#f48771] hover:bg-[#3a1a1a] transition-colors border border-[#f48771]/30"
        >
          {t('diff.reject')}
        </button>
        <button
          onClick={onAccept}
          className="rounded bg-[#0e639c] px-3 py-1 text-xs text-white hover:bg-[#1177bb] transition-colors"
        >
          {t('diff.accept')}
        </button>
      </div>
    </div>
  );
}
