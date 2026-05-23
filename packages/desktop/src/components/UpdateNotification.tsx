import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface UpdateInfo {
  currentVersion: string;
  newVersion: string;
  releaseNotes?: string;
  downloadUrl: string;
}

interface Props {
  update: UpdateInfo;
  onDismiss: () => void;
  onSkipVersion: () => void;
}

type DownloadState = 'idle' | 'downloading' | 'ready' | 'installing';

export default function UpdateNotification({ update, onDismiss, onSkipVersion }: Props) {
  const { t } = useTranslation();
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  // Simulate download progress
  useEffect(() => {
    if (downloadState !== 'downloading') return;
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloadState('ready');
          return 100;
        }
        return prev + Math.random() * 8 + 2;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [downloadState]);

  function handleDownload() {
    setDownloadState('downloading');
    setDownloadProgress(0);
  }

  function handleInstall() {
    setDownloadState('installing');
    // In real app: invoke('install_update')
  }

  return (
    <div
      className="fixed bottom-8 right-4 z-50 w-80 rounded-lg border border-[#3e3e42] bg-[#252526] shadow-2xl"
      role="alert"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3e3e42] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0e639c]">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
              <path d="M5 1v6M2 5l3 3 3-3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-[#cccccc]">{t('update.title')}</span>
        </div>
        <button
          onClick={onDismiss}
          className="rounded p-0.5 text-[#6b6b6b] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors"
          aria-label={t('update.remindLater')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Version info */}
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-[#3e3e42] px-1.5 py-0.5 font-mono text-[#9d9d9d]">
            v{update.currentVersion}
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-[#6b6b6b]">
            <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="rounded bg-[#0e639c]/20 px-1.5 py-0.5 font-mono text-[#4fc1ff]">
            v{update.newVersion}
          </span>
        </div>

        {/* Release notes toggle */}
        {update.releaseNotes && (
          <div>
            <button
              onClick={() => setShowNotes((v) => !v)}
              className="flex items-center gap-1 text-xs text-[#6b6b6b] hover:text-[#9d9d9d] transition-colors"
            >
              <svg
                width="9" height="9" viewBox="0 0 9 9" fill="currentColor"
                className={`transition-transform ${showNotes ? 'rotate-90' : ''}`}
              >
                <path d="M2 1.5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
              {t('update.releaseNotes')}
            </button>
            {showNotes && (
              <div className="mt-1.5 max-h-24 overflow-y-auto rounded border border-[#3e3e42] bg-[#2d2d30] px-2 py-1.5">
                <p className="text-xs text-[#9d9d9d] whitespace-pre-wrap">{update.releaseNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Download progress */}
        {(downloadState === 'downloading' || downloadState === 'ready') && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[#9d9d9d]">
                {downloadState === 'ready' ? t('update.downloadComplete') : t('update.downloading')}
              </span>
              {downloadState === 'downloading' && (
                <span className="text-[#6b6b6b]">{Math.round(downloadProgress)}%</span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#3e3e42]">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  downloadState === 'ready' ? 'bg-[#4ec9b0]' : 'bg-[#0e639c]'
                }`}
                style={{ width: `${Math.min(downloadProgress, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Installing state */}
        {downloadState === 'installing' && (
          <div className="flex items-center gap-2 text-xs text-[#9d9d9d]">
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
            {t('update.installing')}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {downloadState === 'idle' && (
            <>
              <button
                onClick={handleDownload}
                className="flex-1 rounded bg-[#0e639c] py-1.5 text-xs text-white hover:bg-[#1177bb] transition-colors"
              >
                {t('update.download')}
              </button>
              <button
                onClick={onDismiss}
                className="rounded border border-[#3e3e42] px-3 py-1.5 text-xs text-[#9d9d9d] hover:bg-[#2a2d2e] transition-colors"
              >
                {t('update.remindLater')}
              </button>
            </>
          )}

          {downloadState === 'downloading' && (
            <button
              disabled
              className="flex-1 rounded bg-[#0e639c]/50 py-1.5 text-xs text-white/50 cursor-not-allowed"
            >
              {t('update.downloading')}
            </button>
          )}

          {downloadState === 'ready' && (
            <button
              onClick={handleInstall}
              className="flex-1 rounded bg-[#4ec9b0] py-1.5 text-xs text-[#1e1e1e] font-semibold hover:bg-[#3db89f] transition-colors"
            >
              {t('update.installRestart')}
            </button>
          )}
        </div>

        {/* Skip version */}
        {downloadState === 'idle' && (
          <button
            onClick={onSkipVersion}
            className="w-full text-center text-xs text-[#6b6b6b] hover:text-[#9d9d9d] transition-colors"
          >
            {t('update.skipVersion')}
          </button>
        )}
      </div>
    </div>
  );
}
