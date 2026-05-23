import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface IndexedFile {
  path: string;
  chunks: number;
  status: 'indexed' | 'pending' | 'error';
  lastIndexed?: number;
}

interface SearchResult {
  path: string;
  snippet: string;
  score: number;
  lineStart: number;
}

interface RagSettings {
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
}

const EMBEDDING_MODELS = [
  { id: 'text-embedding-3-small', name: 'OpenAI text-embedding-3-small' },
  { id: 'text-embedding-3-large', name: 'OpenAI text-embedding-3-large' },
  { id: 'nomic-embed-text', name: 'Nomic Embed Text (local)' },
  { id: 'mxbai-embed-large', name: 'mxbai-embed-large (local)' },
];

const MOCK_FILES: IndexedFile[] = [
  { path: 'src/App.tsx', chunks: 12, status: 'indexed', lastIndexed: Date.now() - 3600000 },
  { path: 'src/components/Chat.tsx', chunks: 28, status: 'indexed', lastIndexed: Date.now() - 3600000 },
  { path: 'src/stores/agent.ts', chunks: 8, status: 'indexed', lastIndexed: Date.now() - 3600000 },
  { path: 'src/hooks/useTauri.ts', chunks: 4, status: 'indexed', lastIndexed: Date.now() - 3600000 },
  { path: 'src/components/Settings.tsx', chunks: 18, status: 'pending' },
  { path: 'src/components/Terminal.tsx', chunks: 0, status: 'error' },
];

const MOCK_RESULTS: SearchResult[] = [
  { path: 'src/components/Chat.tsx', snippet: 'function handleSend() {\n  const msg = inputValue.trim();\n  if (!msg) return;', score: 0.94, lineStart: 42 },
  { path: 'src/stores/agent.ts', snippet: 'startStreaming: () =>\n  set({\n    streaming: { isStreaming: true, currentContent: \'\' }', score: 0.87, lineStart: 91 },
  { path: 'src/App.tsx', snippet: 'useAgent();\n// Ctrl+Shift+P → command palette', score: 0.72, lineStart: 46 },
];

export default function RagPanel() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<IndexedFile[]>(MOCK_FILES);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [ragSettings, setRagSettings] = useState<RagSettings>({
    chunkSize: 512,
    chunkOverlap: 64,
    embeddingModel: 'text-embedding-3-small',
  });

  const totalChunks = files.reduce((sum, f) => sum + f.chunks, 0);
  const indexedCount = files.filter((f) => f.status === 'indexed').length;

  async function handleIndexProject() {
    setIsIndexing(true);
    setIndexProgress(0);
    const interval = setInterval(() => {
      setIndexProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsIndexing(false);
          setFiles((prev) =>
            prev.map((f) => ({
              ...f,
              status: 'indexed' as const,
              chunks: f.chunks || Math.floor(Math.random() * 20) + 4,
              lastIndexed: Date.now(),
            })),
          );
          return 100;
        }
        return prev + Math.random() * 6 + 2;
      });
    }, 150);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    await new Promise((r) => setTimeout(r, 600));
    setSearchResults(MOCK_RESULTS);
    setIsSearching(false);
  }

  function fileStatusIcon(status: IndexedFile['status']) {
    if (status === 'indexed') return <span className="text-[#4ec9b0]">✓</span>;
    if (status === 'error') return <span className="text-[#f44747]">✗</span>;
    return <span className="h-2.5 w-2.5 animate-spin rounded-full border border-[#9d9d9d] border-t-transparent inline-block" />;
  }

  function formatTime(ts?: number) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return t('rag.justNow');
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ${t('rag.ago')}`;
    return `${Math.round(diff / 3600000)}h ${t('rag.ago')}`;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#252526]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3e3e42] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">
          {t('rag.title')}
        </span>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={`rounded p-1 transition-colors ${
            showSettings ? 'bg-[#0e639c] text-white' : 'text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc]'
          }`}
          title={t('rag.settings')}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.1 4.4L8.1 2H7l-1 2.4-.3.1-2-1.3-.7.7 1.3 2-.1.3L2 7v1l2.4 1 .1.3-1.3 2 .7.7 2-1.3.3.1L7 13h1l1-2.4.3-.1 2 1.3.7-.7-1.3-2 .1-.3L13 8V7l-2.4-1-.1-.3 1.3-2-.7-.7-2 1.3-.3-.2zM8 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Settings panel */}
        {showSettings && (
          <div className="border-b border-[#3e3e42] bg-[#2d2d30] px-3 py-3 space-y-2">
            <p className="text-xs font-semibold text-[#cccccc]">{t('rag.settings')}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-[#9d9d9d]">{t('rag.chunkSize')}</label>
                <input
                  type="number"
                  value={ragSettings.chunkSize}
                  onChange={(e) => setRagSettings((s) => ({ ...s, chunkSize: Number(e.target.value) }))}
                  className="w-full rounded border border-[#3e3e42] bg-[#252526] px-2 py-1 text-xs text-[#cccccc] outline-none focus:border-[#0e639c]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9d9d9d]">{t('rag.chunkOverlap')}</label>
                <input
                  type="number"
                  value={ragSettings.chunkOverlap}
                  onChange={(e) => setRagSettings((s) => ({ ...s, chunkOverlap: Number(e.target.value) }))}
                  className="w-full rounded border border-[#3e3e42] bg-[#252526] px-2 py-1 text-xs text-[#cccccc] outline-none focus:border-[#0e639c]"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#9d9d9d]">{t('rag.embeddingModel')}</label>
              <select
                value={ragSettings.embeddingModel}
                onChange={(e) => setRagSettings((s) => ({ ...s, embeddingModel: e.target.value }))}
                className="w-full rounded border border-[#3e3e42] bg-[#252526] px-2 py-1 text-xs text-[#cccccc] outline-none focus:border-[#0e639c]"
              >
                {EMBEDDING_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Index stats */}
        <div className="border-b border-[#3e3e42] px-3 py-2">
          <div className="flex items-center justify-between text-xs text-[#9d9d9d]">
            <span>{indexedCount}/{files.length} {t('rag.filesIndexed')}</span>
            <span>{totalChunks} {t('rag.chunks')}</span>
          </div>
          {isIndexing && (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[#9d9d9d]">{t('rag.indexing')}</span>
                <span className="text-[#6b6b6b]">{Math.round(indexProgress)}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[#3e3e42]">
                <div
                  className="h-full rounded-full bg-[#0e639c] transition-all duration-200"
                  style={{ width: `${Math.min(indexProgress, 100)}%` }}
                />
              </div>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleIndexProject}
              disabled={isIndexing}
              className="flex-1 rounded bg-[#0e639c] py-1.5 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50 transition-colors"
            >
              {isIndexing ? t('rag.indexing') : t('rag.indexProject')}
            </button>
            <button
              onClick={handleIndexProject}
              disabled={isIndexing}
              className="rounded border border-[#3e3e42] px-2 py-1.5 text-xs text-[#9d9d9d] hover:bg-[#2a2d2e] disabled:opacity-50 transition-colors"
              title={t('rag.reindex')}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.5 2.5A7 7 0 1 0 15 8h-1.5A5.5 5.5 0 1 1 8 2.5V1L11 4 8 7V5.5A5.5 5.5 0 0 0 2.5 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="border-b border-[#3e3e42] px-3 py-2 space-y-2">
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('rag.searchPlaceholder')}
              className="flex-1 rounded border border-[#3e3e42] bg-[#2d2d30] px-2 py-1.5 text-xs text-[#cccccc] placeholder-[#6b6b6b] outline-none focus:border-[#0e639c]"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="rounded bg-[#0e639c] px-3 py-1.5 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50 transition-colors"
            >
              {isSearching ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent block" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
                </svg>
              )}
            </button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-[#6b6b6b]">{searchResults.length} {t('rag.results')}</p>
              {searchResults.map((result, i) => (
                <div key={i} className="rounded border border-[#3e3e42] bg-[#2d2d30] px-2 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#9cdcfe] truncate">{result.path}:{result.lineStart}</span>
                    <span className="ml-2 flex-shrink-0 text-xs text-[#4ec9b0]">{(result.score * 100).toFixed(0)}%</span>
                  </div>
                  <pre className="mt-1 overflow-x-auto text-xs text-[#9d9d9d] leading-relaxed">{result.snippet}</pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Indexed files list */}
        <div>
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">
            {t('rag.indexedFiles')}
          </p>
          {files.map((file) => (
            <div key={file.path} className="flex items-center gap-2 border-b border-[#3e3e42]/50 px-3 py-1.5 hover:bg-[#2a2d2e]">
              <span className="flex-shrink-0 text-xs">{fileStatusIcon(file.status)}</span>
              <span className="flex-1 truncate font-mono text-xs text-[#cccccc]">{file.path}</span>
              <span className="flex-shrink-0 text-xs text-[#6b6b6b]">
                {file.chunks > 0 ? `${file.chunks}c` : ''}
              </span>
              {file.lastIndexed && (
                <span className="flex-shrink-0 text-xs text-[#6b6b6b]">{formatTime(file.lastIndexed)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
