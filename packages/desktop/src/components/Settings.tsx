import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '../stores/settings';
import { useTauri } from '../hooks/useTauri';
import { PROVIDER_PRESETS } from '@aide/shared';
import type { PermissionMode } from '@aide/shared';

interface Props {
  onClose: () => void;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'failed';

export default function Settings({ onClose }: Props) {
  const { t, i18n } = useTranslation();
  const settings = useSettingsStore();
  const { testProvider, setConfig } = useTauri();

  // Local form state (only committed on Save)
  const [providerId, setProviderId] = useState(settings.provider.id);
  const [apiKey, setApiKey] = useState(settings.provider.apiKey);
  const [model, setModel] = useState(settings.provider.model);
  const [baseUrl, setBaseUrl] = useState(settings.provider.baseUrl);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(settings.permissionMode);
  const [thinkingEnabled, setThinkingEnabled] = useState(settings.thinkingEnabled);
  const [thinkingEffort, setThinkingEffort] = useState(settings.thinkingEffort);
  const [maxIterations, setMaxIterations] = useState(settings.maxIterations);
  const [workingDirectory, setWorkingDirectory] = useState(settings.workingDirectory);
  const [language, setLanguage] = useState(settings.language);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [saved, setSaved] = useState(false);

  const selectedPreset = PROVIDER_PRESETS.find((p) => p.id === providerId) ?? PROVIDER_PRESETS[0];
  const availableModels = selectedPreset.models;

  // When provider changes, update baseUrl and reset model to first available
  function handleProviderChange(id: string) {
    const preset = PROVIDER_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setProviderId(id);
    setBaseUrl(preset.baseUrl);
    setModel(preset.models[0].id);
  }

  async function handleTestConnection() {
    setTestStatus('testing');
    try {
      // Listen for the rpc.response event to get the result
      const unlisten = await listen<{ result?: unknown; error?: { message: string } }>(
        'rpc.response',
        (event) => {
          unlisten();
          if (event.payload.error) {
            setTestStatus('failed');
          } else {
            setTestStatus('ok');
          }
          setTimeout(() => setTestStatus('idle'), 3000);
        },
      );
      await testProvider({ baseUrl, apiKey, model });
    } catch {
      setTestStatus('failed');
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  }

  async function handleSave() {
    // Update Zustand store
    settings.setProvider({ id: providerId, apiKey, model, baseUrl });
    settings.setPermissionMode(permissionMode);
    settings.setThinkingEnabled(thinkingEnabled);
    settings.setThinkingEffort(thinkingEffort);
    settings.setMaxIterations(maxIterations);
    settings.setWorkingDirectory(workingDirectory);
    settings.setLanguage(language);

    // Update i18n language
    i18n.changeLanguage(language);

    // Sync to sidecar
    try {
      await setConfig({
        provider: { id: providerId, apiKey, model, baseUrl },
        agent: {
          maxIterations,
          thinkingEnabled,
          thinkingEffort,
          permissionMode,
          workingDirectory,
        },
      });
    } catch (err) {
      console.error('setConfig error:', err);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="flex h-[90vh] w-full max-w-lg flex-col rounded-lg border border-[#3e3e42] bg-[#252526] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3e3e42] px-4 py-3">
          <h2 id="settings-title" className="text-sm font-semibold text-[#cccccc]">
            {t('settings.title')}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc] transition-colors"
            aria-label={t('settings.close')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Provider */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">
              {t('settings.provider')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[#9d9d9d]">{t('settings.provider')}</label>
                <select
                  value={providerId}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-1.5 text-sm text-[#cccccc] outline-none focus:border-[#0e639c]"
                >
                  {PROVIDER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameZh} ({p.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#9d9d9d]">{t('settings.model')}</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-1.5 text-sm text-[#cccccc] outline-none focus:border-[#0e639c]"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#9d9d9d]">{t('settings.baseUrl')}</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-1.5 text-sm text-[#cccccc] outline-none focus:border-[#0e639c]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#9d9d9d]">{t('settings.apiKey')}</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('settings.apiKeyPlaceholder')}
                  className="w-full rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-1.5 text-sm text-[#cccccc] placeholder-[#6b6b6b] outline-none focus:border-[#0e639c]"
                />
              </div>

              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing' || !apiKey}
                className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                  testStatus === 'ok'
                    ? 'bg-[#4ec9b0]/20 text-[#4ec9b0]'
                    : testStatus === 'failed'
                    ? 'bg-[#f44747]/20 text-[#f44747]'
                    : 'bg-[#2d2d30] text-[#9d9d9d] hover:bg-[#3e3e42] hover:text-[#cccccc]'
                }`}
              >
                {testStatus === 'testing' && (
                  <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                )}
                {testStatus === 'ok' && '✓'}
                {testStatus === 'failed' && '✗'}
                {testStatus === 'testing'
                  ? t('settings.testing')
                  : testStatus === 'ok'
                  ? t('settings.connectionOk')
                  : testStatus === 'failed'
                  ? t('settings.connectionFailed')
                  : t('settings.testConnection')}
              </button>
            </div>
          </section>

          {/* Agent behavior */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">
              Agent
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[#9d9d9d]">
                  {t('settings.permissionMode')}
                </label>
                <select
                  value={permissionMode}
                  onChange={(e) => setPermissionMode(e.target.value as PermissionMode)}
                  className="w-full rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-1.5 text-sm text-[#cccccc] outline-none focus:border-[#0e639c]"
                >
                  <option value="safe">{t('settings.permissionSafe')}</option>
                  <option value="trusted">{t('settings.permissionTrusted')}</option>
                  <option value="locked">{t('settings.permissionLocked')}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#9d9d9d]">
                  {t('settings.maxIterations')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(Number(e.target.value))}
                  className="w-full rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-1.5 text-sm text-[#cccccc] outline-none focus:border-[#0e639c]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#9d9d9d]">
                  {t('settings.workingDirectory')}
                </label>
                <input
                  type="text"
                  value={workingDirectory}
                  onChange={(e) => setWorkingDirectory(e.target.value)}
                  placeholder="e.g. C:\Users\admin\projects"
                  className="w-full rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-1.5 text-sm text-[#cccccc] placeholder-[#6b6b6b] outline-none focus:border-[#0e639c]"
                />
              </div>

              {/* Thinking toggle */}
              {selectedPreset.supportsThinking && (
                <>
                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="text-xs text-[#9d9d9d]">{t('settings.thinking')}</span>
                    <button
                      role="switch"
                      aria-checked={thinkingEnabled}
                      onClick={() => setThinkingEnabled((v) => !v)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        thinkingEnabled ? 'bg-[#0e639c]' : 'bg-[#3e3e42]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          thinkingEnabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>

                  {thinkingEnabled && (
                    <div>
                      <label className="mb-1 block text-xs text-[#9d9d9d]">
                        {t('settings.thinkingEffort')}
                      </label>
                      <div className="flex gap-2">
                        {(['low', 'medium', 'high'] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => setThinkingEffort(level)}
                            className={`flex-1 rounded border py-1 text-xs transition-colors ${
                              thinkingEffort === level
                                ? 'border-[#0e639c] bg-[#0e639c]/20 text-[#4fc1ff]'
                                : 'border-[#3e3e42] bg-[#2d2d30] text-[#9d9d9d] hover:border-[#555]'
                            }`}
                          >
                            {t(`settings.thinking${level.charAt(0).toUpperCase() + level.slice(1)}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* UI */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">
              UI
            </h3>
            <div>
              <label className="mb-1 block text-xs text-[#9d9d9d]">{t('settings.language')}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'zh-CN')}
                className="w-full rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-1.5 text-sm text-[#cccccc] outline-none focus:border-[#0e639c]"
              >
                <option value="zh-CN">中文</option>
                <option value="en">English</option>
              </select>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#3e3e42] px-4 py-3">
          <button
            onClick={onClose}
            className="rounded border border-[#3e3e42] bg-transparent px-4 py-1.5 text-sm text-[#cccccc] hover:bg-[#2a2d2e] transition-colors"
          >
            {t('settings.close')}
          </button>
          <button
            onClick={handleSave}
            className={`rounded px-4 py-1.5 text-sm text-white transition-colors ${
              saved ? 'bg-[#4ec9b0]' : 'bg-[#0e639c] hover:bg-[#1177bb]'
            }`}
          >
            {saved ? t('settings.saved') : t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
