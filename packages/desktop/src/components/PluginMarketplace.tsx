import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type PluginCategory = 'all' | 'tools' | 'providers' | 'ui' | 'integrations';

interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: Exclude<PluginCategory, 'all'>;
  permissions: string[];
  installed: boolean;
  enabled: boolean;
  downloads: number;
  rating: number;
  icon?: string;
}

interface Props {
  onClose: () => void;
}

const PLUGINS: Plugin[] = [
  {
    id: 'github-tools',
    name: 'GitHub Tools',
    description: 'Create PRs, review issues, manage branches directly from AiDE.',
    author: 'AiDE Team',
    version: '1.2.0',
    category: 'integrations',
    permissions: ['network', 'env'],
    installed: true,
    enabled: true,
    downloads: 12400,
    rating: 4.8,
  },
  {
    id: 'prettier-format',
    name: 'Prettier Format',
    description: 'Auto-format code with Prettier on save or on demand.',
    author: 'community',
    version: '0.9.1',
    category: 'tools',
    permissions: ['filesystem'],
    installed: true,
    enabled: false,
    downloads: 8900,
    rating: 4.5,
  },
  {
    id: 'openai-provider',
    name: 'OpenAI Provider',
    description: 'Use GPT-4o and o1 models as your AI backend.',
    author: 'AiDE Team',
    version: '2.0.0',
    category: 'providers',
    permissions: ['network', 'env'],
    installed: false,
    enabled: false,
    downloads: 21000,
    rating: 4.7,
  },
  {
    id: 'dark-plus-theme',
    name: 'Dark+ Theme',
    description: 'VS Code Dark+ inspired color theme for AiDE.',
    author: 'themedev',
    version: '1.0.3',
    category: 'ui',
    permissions: [],
    installed: false,
    enabled: false,
    downloads: 5600,
    rating: 4.3,
  },
  {
    id: 'jira-integration',
    name: 'Jira Integration',
    description: 'Link commits to Jira tickets, view issue details in context.',
    author: 'enterprise-plugins',
    version: '1.1.0',
    category: 'integrations',
    permissions: ['network', 'env'],
    installed: false,
    enabled: false,
    downloads: 3200,
    rating: 4.1,
  },
  {
    id: 'test-runner',
    name: 'Test Runner',
    description: 'Run Jest, Vitest, or pytest tests inline with results in chat.',
    author: 'AiDE Team',
    version: '1.3.2',
    category: 'tools',
    permissions: ['filesystem', 'shell'],
    installed: false,
    enabled: false,
    downloads: 9800,
    rating: 4.6,
  },
  {
    id: 'gemini-provider',
    name: 'Gemini Provider',
    description: 'Use Google Gemini 1.5 Pro and Flash models.',
    author: 'AiDE Team',
    version: '1.0.0',
    category: 'providers',
    permissions: ['network', 'env'],
    installed: false,
    enabled: false,
    downloads: 7100,
    rating: 4.4,
  },
  {
    id: 'minimap',
    name: 'Code Minimap',
    description: 'Show a minimap of the current file in the sidebar.',
    author: 'uicraft',
    version: '0.5.0',
    category: 'ui',
    permissions: [],
    installed: false,
    enabled: false,
    downloads: 2100,
    rating: 3.9,
  },
];

const CATEGORIES: Array<{ id: PluginCategory; label: string }> = [
  { id: 'all', label: 'plugin.catAll' },
  { id: 'tools', label: 'plugin.catTools' },
  { id: 'providers', label: 'plugin.catProviders' },
  { id: 'ui', label: 'plugin.catUI' },
  { id: 'integrations', label: 'plugin.catIntegrations' },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width="9" height="9" viewBox="0 0 10 10" fill={star <= Math.round(rating) ? '#dcdcaa' : '#3e3e42'}>
          <path d="M5 1l1.2 2.5L9 4l-2 2 .5 2.8L5 7.5 2.5 8.8 3 6 1 4l2.8-.5L5 1z" />
        </svg>
      ))}
      <span className="ml-1 text-xs text-[#6b6b6b]">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function PluginMarketplace({ onClose }: Props) {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<Plugin[]>(PLUGINS);
  const [activeTab, setActiveTab] = useState<'browse' | 'installed'>('browse');
  const [category, setCategory] = useState<PluginCategory>('all');
  const [search, setSearch] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [installing, setInstalling] = useState<Set<string>>(new Set());

  const filtered = plugins.filter((p) => {
    const matchesTab = activeTab === 'installed' ? p.installed : true;
    const matchesCat = category === 'all' || p.category === category;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesCat && matchesSearch;
  });

  async function handleInstall(id: string) {
    setInstalling((prev) => new Set(prev).add(id));
    await new Promise((r) => setTimeout(r, 1200));
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, installed: true, enabled: true } : p)));
    setInstalling((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function handleUninstall(id: string) {
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, installed: false, enabled: false } : p)));
    if (selectedPlugin?.id === id) setSelectedPlugin(null);
  }

  function handleToggleEnabled(id: string) {
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  }

  function formatDownloads(n: number) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  function categoryBadgeColor(cat: Plugin['category']) {
    switch (cat) {
      case 'tools': return 'bg-[#0e639c]/20 text-[#4fc1ff]';
      case 'providers': return 'bg-[#4ec9b0]/20 text-[#4ec9b0]';
      case 'ui': return 'bg-[#dcdcaa]/20 text-[#dcdcaa]';
      case 'integrations': return 'bg-[#c586c0]/20 text-[#c586c0]';
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plugin-title"
    >
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-[#3e3e42] bg-[#252526] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3e3e42] px-4 py-3">
          <h2 id="plugin-title" className="text-sm font-semibold text-[#cccccc]">
            {t('plugin.title')}
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

        {/* Tabs */}
        <div className="flex border-b border-[#3e3e42] px-4">
          {(['browse', 'installed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-3 py-2 text-xs transition-colors ${
                activeTab === tab
                  ? 'border-[#0e639c] text-[#cccccc]'
                  : 'border-transparent text-[#9d9d9d] hover:text-[#cccccc]'
              }`}
            >
              {t(`plugin.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
              {tab === 'installed' && (
                <span className="ml-1.5 rounded-full bg-[#3e3e42] px-1.5 py-0.5 text-xs">
                  {plugins.filter((p) => p.installed).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: list */}
          <div className="flex w-72 flex-shrink-0 flex-col border-r border-[#3e3e42]">
            {/* Search */}
            <div className="border-b border-[#3e3e42] px-3 py-2">
              <div className="flex items-center gap-2 rounded border border-[#3e3e42] bg-[#2d2d30] px-2 py-1.5">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-[#6b6b6b]">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('plugin.search')}
                  className="flex-1 bg-transparent text-xs text-[#cccccc] placeholder-[#6b6b6b] outline-none"
                />
              </div>
            </div>

            {/* Category filter */}
            {activeTab === 'browse' && (
              <div className="flex flex-wrap gap-1 border-b border-[#3e3e42] px-3 py-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
                      category === cat.id
                        ? 'bg-[#0e639c] text-white'
                        : 'bg-[#2d2d30] text-[#9d9d9d] hover:bg-[#3e3e42]'
                    }`}
                  >
                    {t(cat.label)}
                  </button>
                ))}
              </div>
            )}

            {/* Plugin list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-xs text-[#6b6b6b]">{t('plugin.noResults')}</p>
              )}
              {filtered.map((plugin) => (
                <button
                  key={plugin.id}
                  onClick={() => setSelectedPlugin(plugin)}
                  className={`flex w-full items-start gap-3 border-b border-[#3e3e42]/50 px-3 py-2.5 text-left transition-colors ${
                    selectedPlugin?.id === plugin.id ? 'bg-[#2a2d2e]' : 'hover:bg-[#2a2d2e]'
                  }`}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-[#3e3e42] text-sm">
                    {plugin.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#cccccc] truncate">{plugin.name}</span>
                      {plugin.installed && (
                        <span className="flex-shrink-0 rounded bg-[#4ec9b0]/20 px-1 py-0.5 text-xs text-[#4ec9b0]">
                          {plugin.enabled ? t('plugin.enabled') : t('plugin.disabled')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#9d9d9d] line-clamp-2">{plugin.description}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StarRating rating={plugin.rating} />
                      <span className="text-xs text-[#6b6b6b]">{formatDownloads(plugin.downloads)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: detail */}
          {selectedPlugin ? (
            <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4 space-y-4">
              {/* Plugin header */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#3e3e42] text-xl font-bold text-[#cccccc]">
                  {selectedPlugin.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-[#cccccc]">{selectedPlugin.name}</h3>
                  <p className="text-xs text-[#9d9d9d]">
                    {t('plugin.by')} {selectedPlugin.author} · v{selectedPlugin.version}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <StarRating rating={selectedPlugin.rating} />
                    <span className="text-xs text-[#6b6b6b]">
                      {formatDownloads(selectedPlugin.downloads)} {t('plugin.downloads')}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${categoryBadgeColor(selectedPlugin.category)}`}>
                      {t(`plugin.cat${selectedPlugin.category.charAt(0).toUpperCase() + selectedPlugin.category.slice(1)}`)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">{t('plugin.description')}</p>
                <p className="text-sm text-[#9d9d9d]">{selectedPlugin.description}</p>
              </div>

              {/* Permissions */}
              {selectedPlugin.permissions.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">{t('plugin.permissions')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPlugin.permissions.map((perm) => (
                      <span key={perm} className="rounded border border-[#dcdcaa]/30 bg-[#dcdcaa]/10 px-2 py-0.5 text-xs text-[#dcdcaa]">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {!selectedPlugin.installed ? (
                  <button
                    onClick={() => handleInstall(selectedPlugin.id)}
                    disabled={installing.has(selectedPlugin.id)}
                    className="flex items-center gap-2 rounded bg-[#0e639c] px-4 py-1.5 text-sm text-white hover:bg-[#1177bb] disabled:opacity-50 transition-colors"
                  >
                    {installing.has(selectedPlugin.id) && (
                      <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                    )}
                    {installing.has(selectedPlugin.id) ? t('plugin.installing') : t('plugin.install')}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleToggleEnabled(selectedPlugin.id)}
                      className={`rounded px-4 py-1.5 text-sm transition-colors ${
                        selectedPlugin.enabled
                          ? 'border border-[#3e3e42] text-[#9d9d9d] hover:bg-[#2a2d2e]'
                          : 'bg-[#0e639c] text-white hover:bg-[#1177bb]'
                      }`}
                    >
                      {selectedPlugin.enabled ? t('plugin.disable') : t('plugin.enable')}
                    </button>
                    <button
                      onClick={() => handleUninstall(selectedPlugin.id)}
                      className="rounded border border-[#f44747]/40 px-4 py-1.5 text-sm text-[#f44747] hover:bg-[#f44747]/10 transition-colors"
                    >
                      {t('plugin.uninstall')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-[#6b6b6b]">{t('plugin.selectPlugin')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
