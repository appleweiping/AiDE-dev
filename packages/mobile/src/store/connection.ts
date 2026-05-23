/**
 * connection.ts — AiDE Mobile connection store
 *
 * Full-featured store matching Codex mobile capabilities:
 * - Streaming content + reasoning display
 * - Tool call details (args + output, expandable)
 * - Diff hunks from file edits
 * - Model switching
 * - Multi-session management
 * - Reconnect with exponential backoff + heartbeat
 * - Offline message queue
 * - Push notification scheduling
 */

import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface DiffHunk {
  oldStart: number;
  oldLines: string[];
  newStart: number;
  newLines: string[];
  type: 'add' | 'remove' | 'context';
}

export interface ToolCallDetail {
  id: string;
  name: string;
  args: Record<string, unknown>;
  output?: string;
  isError?: boolean;
  elapsedMs?: number;
  diffs?: DiffHunk[];
  screenshotBase64?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'reasoning';
  content: string;
  timestamp: number;
  toolCall?: ToolCallDetail;
  isError?: boolean;
  isStreaming?: boolean;
}

export interface Session {
  id: string;
  title: string;
  workingDirectory: string;
  providerId: string;
  model: string;
  updatedAt: number;
  parentId?: string;
}

export interface ApprovalRequest {
  id: string;
  toolName: string;
  description: string;
  command?: string;
  filePath?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface ProviderPreset {
  id: string;
  name: string;
  models: Array<{ id: string; name: string; contextWindow: number }>;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileEntry[];
}

export interface GitStatus {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface ConnectionStore {
  // Connection
  status: ConnectionStatus;
  relayUrl: string | null;
  token: string | null;
  ws: WebSocket | null;
  desktopOnline: boolean;
  error: string | null;
  reconnectAttempts: number;

  // Sessions
  sessions: Session[];
  activeSessionId: string | null;

  // Messages
  messages: AgentMessage[];
  streamingContent: string;
  streamingReasoning: string;
  isAgentRunning: boolean;

  // Pending approval
  pendingApproval: ApprovalRequest | null;

  // Providers
  providers: ProviderPreset[];
  activeProvider: string | null;
  activeModel: string | null;

  // File browser
  fileTree: FileEntry[];
  fileTreeLoading: boolean;

  // Git
  gitStatus: GitStatus | null;
  gitLog: string[];

  // Offline queue
  offlineQueue: Array<{ method: string; params: Record<string, unknown> }>;

  // Actions
  connect: (relayUrl: string, token: string) => void;
  disconnect: () => void;
  sendMessage: (text: string) => void;
  cancelAgent: () => void;
  respondApproval: (id: string, approved: boolean, remember?: boolean) => void;
  selectSession: (sessionId: string) => void;
  createSession: (workingDirectory: string) => void;
  loadSessions: () => void;
  clearMessages: () => void;
  switchModel: (providerId: string, model: string) => void;
  loadFileTree: (path?: string) => void;
  loadGitStatus: (cwd: string) => void;
  loadGitLog: (cwd: string) => void;
  forkSession: (sessionId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const HEARTBEAT_MS = 20_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const WS_OPEN = 1; // WebSocket.OPEN — use numeric constant, not WebSocket.OPEN (not available in RN)

// Track pending RPC requests so we can route responses correctly
const pendingRequests = new Map<number, string>(); // id → method

function rpc(ws: WebSocket, method: string, params: Record<string, unknown>, id?: number): void {
  if (ws.readyState !== WS_OPEN) return;
  const reqId = id ?? Date.now();
  pendingRequests.set(reqId, method);
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: reqId, method, params }));
}

function parseDiffs(output: string): DiffHunk[] {
  // Parse unified diff output from file_edit tool
  const hunks: DiffHunk[] = [];
  const lines = output.split('\n');
  let current: DiffHunk | null = null;
  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (current) hunks.push(current);
      const m = line.match(/@@ -(\d+).*\+(\d+)/);
      current = { oldStart: parseInt(m?.[1] ?? '0'), oldLines: [], newStart: parseInt(m?.[2] ?? '0'), newLines: [], type: 'context' };
    } else if (current) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        current.newLines.push(line.slice(1));
        current.type = 'add';
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        current.oldLines.push(line.slice(1));
        current.type = 'remove';
      } else {
        current.oldLines.push(line.slice(1));
        current.newLines.push(line.slice(1));
      }
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

async function schedulePushNotification(title: string, body: string): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useConnectionStore = create<ConnectionStore>((set, get) => {

  function sendOrQueue(method: string, params: Record<string, unknown>): void {
    const { ws, status } = get();
    if (ws && ws.readyState === WS_OPEN) {
      rpc(ws, method, params);
    } else if (status !== 'disconnected') {
      set((s) => ({ offlineQueue: [...s.offlineQueue, { method, params }] }));
    }
  }

  function flushQueue(): void {
    const { ws, offlineQueue } = get();
    if (!ws || ws.readyState !== WS_OPEN || offlineQueue.length === 0) return;
    for (const item of offlineQueue) rpc(ws, item.method, item.params);
    set({ offlineQueue: [] });
  }

  function startHeartbeat(ws: WebSocket): void {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (ws.readyState === WS_OPEN) {
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'ping', params: {} }));
      }
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  function scheduleReconnect(relayUrl: string, token: string, attempt: number): void {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = Math.min(1000 * Math.pow(2, attempt), MAX_RECONNECT_DELAY_MS);
    set({ status: 'reconnecting', reconnectAttempts: attempt });
    reconnectTimer = setTimeout(() => {
      get().connect(relayUrl, token);
    }, delay);
  }

  function handleEvent(event: string, data: Record<string, unknown>): void {
    switch (event) {
      case 'relay.connected':
        set({ desktopOnline: Boolean(data.desktopOnline) });
        break;

      case 'desktop.connected':
        set({ desktopOnline: true });
        sendOrQueue('session.list', {});
        sendOrQueue('provider.list', {});
        break;

      case 'desktop.disconnected':
        set({ desktopOnline: false });
        break;

      case 'agent.content':
        set((s) => ({ streamingContent: s.streamingContent + String(data.delta ?? '') }));
        break;

      case 'agent.reasoning':
        set((s) => ({ streamingReasoning: s.streamingReasoning + String(data.delta ?? '') }));
        break;

      case 'agent.tool_start': {
        const call = data.call as { id: string; name: string; arguments: Record<string, unknown> };
        const toolMsg: AgentMessage = {
          id: `tool-${call?.id ?? Date.now()}`,
          role: 'tool',
          content: '',
          timestamp: Date.now(),
          toolCall: {
            id: call?.id ?? String(Date.now()),
            name: call?.name ?? 'tool',
            args: call?.arguments ?? {},
          },
        };
        set((s) => ({ messages: [...s.messages, toolMsg] }));
        break;
      }

      case 'agent.tool_end': {
        const call = data.call as { id: string; name: string };
        const result = data.result as { content: string; isError: boolean };
        const elapsedMs = data.elapsedMs as number | undefined;
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.toolCall?.id === call?.id) {
              const diffs = (call?.name === 'file_edit' || call?.name === 'FileEdit')
                ? parseDiffs(result?.content ?? '')
                : undefined;
              const screenshotBase64 = (call?.name === 'desktop_screenshot' || call?.name === 'browser_screenshot')
                ? result?.content?.replace('data:image/png;base64,', '')
                : undefined;
              return {
                ...m,
                toolCall: {
                  ...m.toolCall!,
                  output: result?.content ?? '',
                  isError: result?.isError ?? false,
                  elapsedMs,
                  diffs,
                  screenshotBase64,
                },
              };
            }
            return m;
          }),
        }));
        break;
      }

      case 'agent.done': {
        const content = String(data.content ?? '');
        const { streamingContent, streamingReasoning, activeSessionId } = get();
        const finalContent = streamingContent || content;

        const msgs: AgentMessage[] = [];
        if (streamingReasoning) {
          msgs.push({
            id: `reasoning-${Date.now()}`,
            role: 'reasoning',
            content: streamingReasoning,
            timestamp: Date.now(),
          });
        }
        msgs.push({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: finalContent,
          timestamp: Date.now(),
        });

        set((s) => ({
          messages: [...s.messages, ...msgs],
          streamingContent: '',
          streamingReasoning: '',
          isAgentRunning: false,
        }));

        // Push notification
        schedulePushNotification('AiDE', finalContent.slice(0, 100) || 'Task complete');
        break;
      }

      case 'agent.error':
        set((s) => ({
          messages: [...s.messages, {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: String(data.error ?? 'Unknown error'),
            timestamp: Date.now(),
            isError: true,
          }],
          streamingContent: '',
          streamingReasoning: '',
          isAgentRunning: false,
        }));
        break;

      case 'approval_request':
        set({ pendingApproval: data as unknown as ApprovalRequest });
        schedulePushNotification('AiDE — Approval Required', `${(data as ApprovalRequest).toolName}: ${(data as ApprovalRequest).description}`);
        break;
    }
  }

  function handleRpcResult(id: number, result: unknown): void {
    const method = pendingRequests.get(id);
    pendingRequests.delete(id);

    switch (method) {
      case 'session.list':
        set({ sessions: Array.isArray(result) ? result as Session[] : [] });
        break;
      case 'provider.list':
        set({ providers: Array.isArray(result) ? result as ProviderPreset[] : [] });
        break;
      case 'fs.list':
        set({ fileTree: Array.isArray(result) ? result as FileEntry[] : [], fileTreeLoading: false });
        break;
      case 'git.status':
        if (result && typeof result === 'object') set({ gitStatus: result as GitStatus });
        break;
      case 'git.log': {
        const r = result as Record<string, unknown> | null;
        if (r && 'output' in r && typeof r.output === 'string') {
          set({ gitLog: r.output.split('\n').filter(Boolean) });
        }
        break;
      }
      default:
        // Unknown or untracked response — ignore
        break;
    }
  }

  return {
    status: 'disconnected',
    relayUrl: null,
    token: null,
    ws: null,
    desktopOnline: false,
    error: null,
    reconnectAttempts: 0,
    sessions: [],
    activeSessionId: null,
    messages: [],
    streamingContent: '',
    streamingReasoning: '',
    isAgentRunning: false,
    pendingApproval: null,
    providers: [],
    activeProvider: null,
    activeModel: null,
    fileTree: [],
    fileTreeLoading: false,
    gitStatus: null,
    gitLog: [],
    offlineQueue: [],

    connect(relayUrl: string, token: string) {
      const existing = get().ws;
      if (existing) { stopHeartbeat(); existing.close(); }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

      set({ status: 'connecting', relayUrl, token, error: null });

      const ws = new WebSocket(`${relayUrl}?token=${encodeURIComponent(token)}&role=mobile`);

      ws.onopen = () => {
        set({ status: 'connected', ws, reconnectAttempts: 0 });
        startHeartbeat(ws);
        flushQueue();
        rpc(ws, 'session.list', {});
        rpc(ws, 'provider.list', {});
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string) as Record<string, unknown>;
          if ('result' in msg) {
            handleRpcResult(msg.id as number, msg.result);
          } else if ('event' in msg) {
            handleEvent(msg.event as string, (msg.data ?? {}) as Record<string, unknown>);
          }
        } catch { /* ignore */ }
      };

      ws.onerror = () => set({ error: 'Connection error' });

      ws.onclose = (evt) => {
        stopHeartbeat();
        set({ ws: null, desktopOnline: false });
        const { relayUrl: url, token: tok, reconnectAttempts } = get();
        if (url && tok && evt.code !== 1000) {
          // Abnormal close — reconnect
          scheduleReconnect(url, tok, reconnectAttempts);
        } else {
          set({ status: 'disconnected' });
        }
      };
    },

    disconnect() {
      stopHeartbeat();
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      get().ws?.close(1000, 'User disconnected');
      set({ status: 'disconnected', ws: null, desktopOnline: false, reconnectAttempts: 0 });
    },

    sendMessage(text: string) {
      const { activeSessionId } = get();
      if (!activeSessionId) return;
      const userMsg: AgentMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, userMsg], streamingContent: '', streamingReasoning: '', isAgentRunning: true }));
      sendOrQueue('agent.run', { sessionId: activeSessionId, message: text });
    },

    cancelAgent() {
      sendOrQueue('agent.cancel', {});
      set({ isAgentRunning: false, streamingContent: '', streamingReasoning: '' });
    },

    respondApproval(id: string, approved: boolean, remember?: boolean) {
      sendOrQueue('approval.respond', { id, approved, remember: remember ?? false });
      set({ pendingApproval: null });
    },

    selectSession(sessionId: string) {
      set({ activeSessionId: sessionId, messages: [], streamingContent: '', streamingReasoning: '', isAgentRunning: false });
    },

    createSession(workingDirectory: string) {
      sendOrQueue('session.create', { workingDirectory, title: 'New Session' });
    },

    loadSessions() {
      sendOrQueue('session.list', {});
    },

    clearMessages() {
      set({ messages: [], streamingContent: '', streamingReasoning: '' });
    },

    switchModel(providerId: string, model: string) {
      set({ activeProvider: providerId, activeModel: model });
      sendOrQueue('config.set', { provider: { id: providerId, model } });
    },

    loadFileTree(path?: string) {
      const { activeSessionId, sessions } = get();
      const session = sessions.find((s) => s.id === activeSessionId);
      const cwd = path ?? session?.workingDirectory ?? '.';
      set({ fileTreeLoading: true });
      sendOrQueue('fs.list', { path: cwd });
    },

    loadGitStatus(cwd: string) {
      sendOrQueue('git.status', { cwd });
    },

    loadGitLog(cwd: string) {
      sendOrQueue('git.log', { cwd, count: 20 });
    },

    forkSession(sessionId: string) {
      sendOrQueue('session.fork', { sessionId });
    },
  };
});
