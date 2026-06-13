import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface TerminalProps {
  visible: boolean;
}

// ── xterm.js lazy loader ──────────────────────────────────────────────────────
// We dynamically import xterm to avoid SSR issues and keep the bundle lean.
// The terminal is only initialized when first made visible.

let xtermLoaded = false;
let Terminal_: typeof import('xterm').Terminal | null = null;
let FitAddon_: typeof import('xterm-addon-fit').FitAddon | null = null;

async function loadXterm() {
  if (xtermLoaded) return;
  try {
    const [xtermMod, fitMod] = await Promise.all([
      import('xterm'),
      import('xterm-addon-fit'),
    ]);
    Terminal_ = xtermMod.Terminal;
    FitAddon_ = fitMod.FitAddon;
    xtermLoaded = true;
  } catch {
    // xterm not installed — terminal will show a fallback message
  }
}

// ── Theme matching the app ────────────────────────────────────────────────────

const XTERM_THEME = {
  background: '#1e1e1e',
  foreground: '#cccccc',
  cursor: '#cccccc',
  cursorAccent: '#1e1e1e',
  black: '#1e1e1e',
  red: '#f48771',
  green: '#4ec9b0',
  yellow: '#dcdcaa',
  blue: '#569cd6',
  magenta: '#c586c0',
  cyan: '#9cdcfe',
  white: '#cccccc',
  brightBlack: '#6b6b6b',
  brightRed: '#f48771',
  brightGreen: '#4ec9b0',
  brightYellow: '#dcdcaa',
  brightBlue: '#569cd6',
  brightMagenta: '#c586c0',
  brightCyan: '#9cdcfe',
  brightWhite: '#ffffff',
  selectionBackground: '#264f78',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function Terminal({ visible }: TerminalProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('xterm').Terminal | null>(null);
  const fitRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const initializedRef = useRef(false);

  // Initialize xterm when first made visible
  useEffect(() => {
    if (!visible || initializedRef.current) return;

    let cancelled = false;

    loadXterm().then(() => {
      if (cancelled || !containerRef.current) return;
      if (!Terminal_ || !FitAddon_) return;

      initializedRef.current = true;

      const term = new Terminal_({
        theme: XTERM_THEME,
        fontFamily: '"Cascadia Code", "Fira Code", "Consolas", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 5000,
        convertEol: true,
      });

      const fitAddon = new FitAddon_();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      termRef.current = term;
      fitRef.current = fitAddon;

      // Welcome message
      term.writeln('\x1b[1;32mAiDE Terminal\x1b[0m — tool output will appear here');
      term.writeln('');

      // Listen for IPC tool output events (Electron)
      const win = window as Window & {
        electronAPI?: {
          onToolOutput?: (cb: (data: string) => void) => () => void;
        };
      };
      if (win.electronAPI?.onToolOutput) {
        const unsub = win.electronAPI.onToolOutput((data: string) => {
          term.write(data);
        });
        return () => {
          unsub();
          term.dispose();
          termRef.current = null;
          fitRef.current = null;
          initializedRef.current = false;
        };
      }
    });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Fit on resize
  useEffect(() => {
    if (!visible || !fitRef.current) return;

    const observer = new ResizeObserver(() => {
      fitRef.current?.fit();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [visible]);

  // Re-fit when visibility changes
  useEffect(() => {
    if (visible && fitRef.current) {
      setTimeout(() => fitRef.current?.fit(), 50);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      {/* Terminal toolbar */}
      <div className="flex items-center justify-between border-b border-[#3e3e42] bg-[#252526] px-3 py-1">
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-[#9d9d9d]">
            <path d="M6 9L1 4l1-1 4 4 4-4 1 1-5 5zm4 4H1v-1h9v1z" />
          </svg>
          <span className="text-xs text-[#9d9d9d]">{t('terminal.title')}</span>
        </div>
        <button
          onClick={() => {
            if (termRef.current) {
              termRef.current.clear();
            }
          }}
          className="rounded px-2 py-0.5 text-[10px] text-[#6b6b6b] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors"
          title={t('terminal.clear')}
        >
          {t('terminal.clear')}
        </button>
      </div>

      {/* xterm container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden p-1"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}
