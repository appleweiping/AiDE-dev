import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface McpTool {
  name: string;
  description: string;
}

interface ToolCallRecord {
  id: string;
  toolName: string;
  args: string;
  result?: string;
  status: 'running' | 'done' | 'error';
  timestamp: number;
}

interface McpServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: 'connected' | 'disconnected' | 'error';
  tools: McpTool[];
  toolHistory: ToolCallRecord[];
  errorMessage?: string;
}

interface Props {
  onClose: () => void;
}

const INITIAL_SERVERS: McpServer[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    env: {},
    status: 'connected',
    tools: [
      { name: 'read_file', description: 'Read file contents' },
      { name: 'write_file', description: 'Write file contents' },
      { name: 'list_directory', description: 'List directory contents' },
    ],
    toolHistory: [
      { id: '1', toolName: 'read_file', args: '{"path":"src/App.tsx"}', result: '...', status: 'done', timestamp: Date.now() - 5000 },
    ],
  },
];

export default function McpManager({ onClose }: Props) {
  const { t } = useTranslation();
  const [servers, setServers] = useState<McpServer[]>(INITIAL_SERVERS);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(INITIAL_SERVERS[0]?.id ?? null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  // Add form state
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newArgs, setNewArgs] = useState('');
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [newEnvPairs, setNewEnvPairs] = useState<Array<[string, string]>>([]);

  const selectedServer = servers.find((s) => s.id === selectedServerId) ?? null;

  function handleAddEnvPair() {
    if (newEnvKey.trim()) {
      setNewEnvPairs((prev) => [...prev, [newEnvKey.trim(), newEnvVal]]);
      setNewEnvKey('');
      setNewEnvVal('');
    }
  }

  function handleRemoveEnvPair(idx: number) {
    setNewEnvPairs((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAddServer() {
    if (!newName.trim() || !newCommand.trim()) return;
    const env: Record<string, string> = {};
    for (const [k, v] of newEnvPairs) env[k] = v;
    const server: McpServer = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      command: newCommand.trim(),
      args: newArgs.split(' ').filter(Boolean),
      env,
      status: 'disconnected',
      tools: [],
      toolHistory: [],
    };
    setServers((prev) => [...prev, server]);
    setSelectedServerId(server.id);
    setShowAddForm(false);
    setNewName('');
    setNewCommand('');
    setNewArgs('');
    setNewEnvPairs([]);
  }

  function handleDisconnect(id: string) {
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'disconnected' } : s)),
    );
  }

  function handleReconnect(id: string) {
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'connected', errorMessage: undefined } : s)),
    );
  }

  function handleRemoveServer(id: string) {
    setServers((prev) => prev.filter((s) => s.id !== id));
    if (selectedServerId === id) {
      setSelectedServerId(servers.find((s) => s.id !== id)?.id ?? null);
    }
  }

  function toggleHistory(id: string) {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function statusDot(status: McpServer['status']) {
    if (status === 'connected') return 'bg-[#4ec9b0]';
    if (status === 'error') return 'bg-[#f44747]';
    return 'bg-[#6b6b6b]';
  }

  function statusLabel(status: McpServer['status']) {
    if (status === 'connected') return t('mcp.statusConnected');
    if (status === 'error') return t('mcp.statusError');
    return t('mcp.statusDisconnected');
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcp-title"
    >
      <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-[#3e3e42] bg-[#252526] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3e3e42] px-4 py-3">
          <h2 id="mcp-title" className="text-sm font-semibold text-[#cccccc]">
            {t('mcp.title')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="rounded border border-[#3e3e42] bg-[#0e639c] px-3 py-1 text-xs text-white hover:bg-[#1177bb] transition-colors"
            >
              + {t('mcp.addServer')}
            </button>
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
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Server list */}
          <div className="flex w-52 flex-shrink-0 flex-col border-r border-[#3e3e42] overflow-y-auto">
            {servers.length === 0 && (
              <p className="px-3 py-4 text-xs text-[#6b6b6b]">{t('mcp.noServers')}</p>
            )}
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => setSelectedServerId(server.id)}
                className={`flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedServerId === server.id
                    ? 'bg-[#2a2d2e] text-[#cccccc]'
                    : 'text-[#9d9d9d] hover:bg-[#2a2d2e] hover:text-[#cccccc]'
                }`}
              >
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusDot(server.status)}`} />
                <span className="flex-1 truncate">{server.name}</span>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Add server form */}
            {showAddForm && (
              <div className="border-b border-[#3e3e42] bg-[#2d2d30] px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-[#cccccc]">{t('mcp.addServer')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-[#9d9d9d]">{t('mcp.serverName')}</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="My Server"
                      className="w-full rounded border border-[#3e3e42] bg-[#252526] px-2 py-1 text-xs text-[#cccccc] outline-none focus:border-[#0e639c]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[#9d9d9d]">{t('mcp.command')}</label>
                    <input
                      value={newCommand}
                      onChange={(e) => setNewCommand(e.target.value)}
                      placeholder="npx"
                      className="w-full rounded border border-[#3e3e42] bg-[#252526] px-2 py-1 text-xs text-[#cccccc] outline-none focus:border-[#0e639c]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#9d9d9d]">{t('mcp.args')}</label>
                  <input
                    value={newArgs}
                    onChange={(e) => setNewArgs(e.target.value)}
                    placeholder="-y @modelcontextprotocol/server-filesystem ."
                    className="w-full rounded border border-[#3e3e42] bg-[#252526] px-2 py-1 text-xs text-[#cccccc] outline-none focus:border-[#0e639c]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#9d9d9d]">{t('mcp.envVars')}</label>
                  <div className="flex gap-2">
                    <input
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      placeholder="KEY"
                      className="w-1/3 rounded border border-[#3e3e42] bg-[#252526] px-2 py-1 text-xs text-[#cccccc] outline-none focus:border-[#0e639c]"
                    />
                    <input
                      value={newEnvVal}
                      onChange={(e) => setNewEnvVal(e.target.value)}
                      placeholder="value"
                      className="flex-1 rounded border border-[#3e3e42] bg-[#252526] px-2 py-1 text-xs text-[#cccccc] outline-none focus:border-[#0e639c]"
                    />
                    <button
                      onClick={handleAddEnvPair}
                      className="rounded border border-[#3e3e42] px-2 py-1 text-xs text-[#9d9d9d] hover:bg-[#3e3e42] transition-colors"
                    >
                      +
                    </button>
                  </div>
                  {newEnvPairs.map(([k, v], i) => (
                    <div key={i} className="mt-1 flex items-center gap-1 text-xs text-[#9d9d9d]">
                      <span className="font-mono">{k}={v}</span>
                      <button onClick={() => handleRemoveEnvPair(i)} className="ml-auto text-[#f44747] hover:text-red-400">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleAddServer}
                    disabled={!newName.trim() || !newCommand.trim()}
                    className="rounded bg-[#0e639c] px-3 py-1 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50 transition-colors"
                  >
                    {t('mcp.connect')}
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="rounded border border-[#3e3e42] px-3 py-1 text-xs text-[#9d9d9d] hover:bg-[#3e3e42] transition-colors"
                  >
                    {t('settings.close')}
                  </button>
                </div>
              </div>
            )}

            {selectedServer ? (
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {/* Server info */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${statusDot(selectedServer.status)}`} />
                      <h3 className="text-sm font-semibold text-[#cccccc]">{selectedServer.name}</h3>
                      <span className="text-xs text-[#6b6b6b]">{statusLabel(selectedServer.status)}</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-[#9d9d9d]">
                      {selectedServer.command} {selectedServer.args.join(' ')}
                    </p>
                    {selectedServer.errorMessage && (
                      <p className="mt-1 text-xs text-[#f44747]">{selectedServer.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedServer.status === 'connected' ? (
                      <button
                        onClick={() => handleDisconnect(selectedServer.id)}
                        className="rounded border border-[#3e3e42] px-2 py-1 text-xs text-[#9d9d9d] hover:bg-[#3e3e42] transition-colors"
                      >
                        {t('mcp.disconnect')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReconnect(selectedServer.id)}
                        className="rounded border border-[#0e639c] px-2 py-1 text-xs text-[#4fc1ff] hover:bg-[#0e639c]/20 transition-colors"
                      >
                        {t('mcp.reconnect')}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveServer(selectedServer.id)}
                      className="rounded border border-[#f44747]/40 px-2 py-1 text-xs text-[#f44747] hover:bg-[#f44747]/10 transition-colors"
                    >
                      {t('mcp.remove')}
                    </button>
                  </div>
                </div>

                {/* Env vars */}
                {Object.keys(selectedServer.env).length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">{t('mcp.envVars')}</p>
                    <div className="rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-2 space-y-1">
                      {Object.entries(selectedServer.env).map(([k]) => (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-[#9cdcfe]">{k}</span>
                          <span className="text-[#6b6b6b]">=</span>
                          <span className="font-mono text-[#ce9178]">••••••</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tools */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">
                    {t('mcp.tools')} ({selectedServer.tools.length})
                  </p>
                  {selectedServer.tools.length === 0 ? (
                    <p className="text-xs text-[#6b6b6b]">{t('mcp.noTools')}</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedServer.tools.map((tool) => (
                        <div
                          key={tool.name}
                          className="rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-2"
                        >
                          <p className="font-mono text-xs text-[#dcdcaa]">{tool.name}</p>
                          <p className="mt-0.5 text-xs text-[#9d9d9d]">{tool.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tool call history */}
                <div>
                  <button
                    onClick={() => toggleHistory(selectedServer.id)}
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#6b6b6b] hover:text-[#9d9d9d] transition-colors"
                  >
                    <svg
                      width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                      className={`transition-transform ${expandedHistory.has(selectedServer.id) ? 'rotate-90' : ''}`}
                    >
                      <path d="M3 2l4 3-4 3V2z" />
                    </svg>
                    {t('mcp.toolHistory')} ({selectedServer.toolHistory.length})
                  </button>
                  {expandedHistory.has(selectedServer.id) && (
                    <div className="mt-2 space-y-1">
                      {selectedServer.toolHistory.length === 0 ? (
                        <p className="text-xs text-[#6b6b6b]">{t('mcp.noHistory')}</p>
                      ) : (
                        selectedServer.toolHistory.map((call) => (
                          <div key={call.id} className="rounded border border-[#3e3e42] bg-[#2d2d30] px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  call.status === 'done' ? 'bg-[#4ec9b0]' :
                                  call.status === 'error' ? 'bg-[#f44747]' : 'bg-[#dcdcaa]'
                                }`}
                              />
                              <span className="font-mono text-xs text-[#dcdcaa]">{call.toolName}</span>
                              <span className="ml-auto text-xs text-[#6b6b6b]">
                                {new Date(call.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-xs text-[#9d9d9d] truncate">{call.args}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-[#6b6b6b]">{t('mcp.selectServer')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
