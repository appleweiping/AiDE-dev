import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CommandCategory = 'session' | 'provider' | 'tools' | 'settings' | 'help';

export interface Command {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  keybinding?: string;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onCommand: (cmd: string) => void;
}

// ── Built-in commands ─────────────────────────────────────────────────────────

const COMMANDS: Command[] = [
  // Session
  { id: 'session.new', label: 'New Session', category: 'session', keybinding: 'Ctrl+N' },
  { id: 'session.export', label: 'Export Session', description: 'Save conversation to file', category: 'session' },
  { id: 'session.clear', label: 'Clear Context', description: 'Remove all messages', category: 'session' },
  { id: 'session.delete', label: 'Delete Session', category: 'session' },
  // Provider
  { id: 'provider.switch', label: 'Switch Provider', description: 'Change AI provider', category: 'provider' },
  { id: 'provider.test', label: 'Test Connection', description: 'Verify API key', category: 'provider' },
  // Tools
  { id: 'tools.toggleThinking', label: 'Toggle Extended Thinking', category: 'tools', keybinding: 'Ctrl+T' },
  { id: 'tools.toggleTerminal', label: 'Toggle Terminal', category: 'tools', keybinding: 'Ctrl+`' },
  { id: 'tools.toggleFileExplorer', label: 'Toggle File Explorer', category: 'tools', keybinding: 'Ctrl+B' },
  { id: 'tools.toggleTaskList', label: 'Toggle Task List', category: 'tools' },
  // Settings
  { id: 'settings.open', label: 'Open Settings', category: 'settings', keybinding: 'Ctrl+,' },
  { id: 'settings.language', label: 'Change Language', category: 'settings' },
  { id: 'settings.permissions', label: 'Permission Mode', description: 'Safe / Trusted / Locked', category: 'settings' },
  // Help
  { id: 'help.shortcuts', label: 'Keyboard Shortcuts', category: 'help', keybinding: 'Ctrl+/' },
  { id: 'help.about', label: 'About AiDE', category: 'help' },
  { id: 'help.docs', label: 'Open Documentation', category: 'help' },
];

// ── Fuzzy match ───────────────────────────────────────────────────────────────

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ── Category label ────────────────────────────────────────────────────────────

const CATEGORY_ORDER: CommandCategory[] = ['session', 'provider', 'tools', 'settings', 'help'];

// ── Main component ────────────────────────────────────────────────────────────

export default function CommandPalette({ open, onClose, onCommand }: CommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    return COMMANDS.filter(
      (cmd) =>
        fuzzyMatch(query, cmd.label) ||
        (cmd.description && fuzzyMatch(query, cmd.description)) ||
        fuzzyMatch(query, cmd.category),
    );
  }, [query]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<CommandCategory, Command[]>();
    for (const cmd of filtered) {
      if (!map.has(cmd.category)) map.set(cmd.category, []);
      map.get(cmd.category)!.push(cmd);
    }
    return map;
  }, [filtered]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => filtered, [filtered]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Clamp active index
  useEffect(() => {
    setActiveIdx((prev) => Math.min(prev, Math.max(0, flatList.length - 1)));
  }, [flatList]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flatList[activeIdx];
        if (cmd) {
          onCommand(cmd.id);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [flatList, activeIdx, onCommand, onClose],
  );

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('commandPalette.title')}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Palette */}
      <div
        className="relative z-10 w-full max-w-lg rounded-lg border border-[#3e3e42] bg-[#252526] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-[#3e3e42] px-3 py-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0 text-[#6b6b6b]">
            <path d="M15.7 13.3l-3.81-3.83A5.93 5.93 0 0 0 13 6c0-3.31-2.69-6-6-6S1 2.69 1 6s2.69 6 6 6c1.3 0 2.48-.41 3.47-1.11l3.83 3.81c.19.2.45.3.7.3.25 0 .52-.09.7-.3a.99.99 0 0 0 0-1.41zM7 11c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm text-[#cccccc] placeholder-[#6b6b6b] outline-none"
            placeholder={t('commandPalette.placeholder')}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={handleKeyDown}
            aria-autocomplete="list"
            aria-controls="command-list"
          />
          <kbd className="rounded border border-[#3e3e42] px-1.5 py-0.5 text-[10px] text-[#6b6b6b]">Esc</kbd>
        </div>

        {/* Command list */}
        <div
          id="command-list"
          ref={listRef}
          className="max-h-80 overflow-y-auto py-1"
          role="listbox"
        >
          {flatList.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#6b6b6b]">
              {t('commandPalette.noResults')}
            </div>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const cmds = grouped.get(category);
              if (!cmds || cmds.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category header */}
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b]">
                    {t(`commandPalette.category.${category}`)}
                  </div>

                  {/* Commands */}
                  {cmds.map((cmd) => {
                    const idx = flatIdx++;
                    const isActive = idx === activeIdx;

                    return (
                      <button
                        key={cmd.id}
                        data-idx={idx}
                        role="option"
                        aria-selected={isActive}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                          isActive ? 'bg-[#0e639c] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                        }`}
                        onClick={() => { onCommand(cmd.id); onClose(); }}
                        onMouseEnter={() => setActiveIdx(idx)}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-sm truncate">{cmd.label}</span>
                          {cmd.description && (
                            <span className={`text-xs truncate ${isActive ? 'text-white/70' : 'text-[#6b6b6b]'}`}>
                              {cmd.description}
                            </span>
                          )}
                        </div>
                        {cmd.keybinding && (
                          <kbd className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                            isActive ? 'border-white/30 text-white/70' : 'border-[#3e3e42] text-[#6b6b6b]'
                          }`}>
                            {cmd.keybinding}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-[#3e3e42] px-3 py-1.5">
          <span className="text-[10px] text-[#6b6b6b]">
            <kbd className="rounded border border-[#3e3e42] px-1 py-0.5">↑↓</kbd> {t('commandPalette.navigate')}
          </span>
          <span className="text-[10px] text-[#6b6b6b]">
            <kbd className="rounded border border-[#3e3e42] px-1 py-0.5">↵</kbd> {t('commandPalette.select')}
          </span>
        </div>
      </div>
    </div>
  );
}
