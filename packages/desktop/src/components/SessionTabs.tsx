import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface SessionTab {
  id: string;
  title: string;
  hasUnsavedChanges: boolean;
}

interface Props {
  tabs: SessionTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onNewTab: () => void;
  onCloseTab: (id: string) => void;
  onRenameTab: (id: string, title: string) => void;
  onDuplicateTab: (id: string) => void;
  onCloseOthers: (id: string) => void;
}

interface ContextMenu {
  tabId: string;
  x: number;
  y: number;
}

export default function SessionTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onNewTab,
  onCloseTab,
  onRenameTab,
  onDuplicateTab,
  onCloseOthers,
}: Props) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSourceId = useRef<string | null>(null);

  function handleContextMenu(e: React.MouseEvent, tabId: string) {
    e.preventDefault();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function handleCloseTab(id: string) {
    const tab = tabs.find((t) => t.id === id);
    if (tab?.hasUnsavedChanges) {
      setConfirmCloseId(id);
    } else {
      onCloseTab(id);
    }
  }

  function handleStartRename(id: string) {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    setRenamingId(id);
    setRenameValue(tab.title);
    closeContextMenu();
  }

  function handleRenameSubmit(id: string) {
    if (renameValue.trim()) {
      onRenameTab(id, renameValue.trim());
    }
    setRenamingId(null);
  }

  // Drag-to-reorder (visual only — actual reorder handled by parent via onDrop)
  function handleDragStart(e: React.DragEvent, id: string) {
    dragSourceId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    setDragOverId(null);
    // Parent can handle reorder if needed; here we just select the dropped tab
    if (dragSourceId.current && dragSourceId.current !== targetId) {
      onSelectTab(dragSourceId.current);
    }
    dragSourceId.current = null;
  }

  function handleDragEnd() {
    setDragOverId(null);
    dragSourceId.current = null;
  }

  return (
    <>
      <div
        className="flex h-9 flex-shrink-0 items-end overflow-x-auto border-b border-[#3e3e42] bg-[#2d2d30]"
        onClick={closeContextMenu}
        role="tablist"
        aria-label={t('tabs.label')}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTabId}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            className={`group relative flex h-full max-w-[180px] min-w-[100px] flex-shrink-0 cursor-pointer items-center border-r border-[#3e3e42] px-3 transition-colors ${
              tab.id === activeTabId
                ? 'bg-[#1e1e1e] text-[#cccccc]'
                : 'bg-[#2d2d30] text-[#9d9d9d] hover:bg-[#252526] hover:text-[#cccccc]'
            } ${dragOverId === tab.id ? 'border-l-2 border-l-[#0e639c]' : ''}`}
          >
            {/* Active indicator */}
            {tab.id === activeTabId && (
              <span className="absolute inset-x-0 top-0 h-0.5 bg-[#0e639c]" />
            )}

            {/* Tab title / rename input */}
            {renamingId === tab.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameSubmit(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(tab.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-[#3e3e42] px-1 text-xs text-[#cccccc] outline-none"
              />
            ) : (
              <button
                onClick={() => onSelectTab(tab.id)}
                onDoubleClick={() => handleStartRename(tab.id)}
                className="flex flex-1 items-center gap-1.5 overflow-hidden text-left"
              >
                {tab.hasUnsavedChanges && (
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#cccccc]" title={t('tabs.unsaved')} />
                )}
                <span className="truncate text-xs">{tab.title}</span>
              </button>
            )}

            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}
              className={`ml-1 flex-shrink-0 rounded p-0.5 transition-colors ${
                tab.id === activeTabId
                  ? 'text-[#9d9d9d] hover:bg-[#3e3e42] hover:text-[#cccccc]'
                  : 'text-transparent group-hover:text-[#9d9d9d] hover:bg-[#3e3e42] hover:text-[#cccccc]'
              }`}
              aria-label={t('tabs.close')}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}

        {/* New tab button */}
        <button
          onClick={onNewTab}
          className="flex h-full flex-shrink-0 items-center px-2 text-[#6b6b6b] hover:bg-[#252526] hover:text-[#cccccc] transition-colors"
          aria-label={t('tabs.newTab')}
          title={t('tabs.newTab')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={closeContextMenu} />
          <div
            className="fixed z-50 min-w-[160px] rounded border border-[#3e3e42] bg-[#252526] py-1 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {[
              { label: t('tabs.rename'), action: () => handleStartRename(contextMenu.tabId) },
              { label: t('tabs.duplicate'), action: () => { onDuplicateTab(contextMenu.tabId); closeContextMenu(); } },
              { label: t('tabs.closeOthers'), action: () => { onCloseOthers(contextMenu.tabId); closeContextMenu(); } },
              { label: t('tabs.close'), action: () => { handleCloseTab(contextMenu.tabId); closeContextMenu(); } },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex w-full items-center px-3 py-1.5 text-xs text-[#cccccc] hover:bg-[#2a2d2e] transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Unsaved changes confirmation */}
      {confirmCloseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-lg border border-[#3e3e42] bg-[#252526] p-4 shadow-2xl w-72">
            <p className="text-sm text-[#cccccc]">{t('tabs.unsavedWarning')}</p>
            <div className="mt-3 flex gap-2 justify-end">
              <button
                onClick={() => setConfirmCloseId(null)}
                className="rounded border border-[#3e3e42] px-3 py-1.5 text-xs text-[#9d9d9d] hover:bg-[#2a2d2e] transition-colors"
              >
                {t('tabs.cancel')}
              </button>
              <button
                onClick={() => { onCloseTab(confirmCloseId); setConfirmCloseId(null); }}
                className="rounded bg-[#f44747] px-3 py-1.5 text-xs text-white hover:bg-red-500 transition-colors"
              >
                {t('tabs.closeAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
