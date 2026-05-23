/**
 * AiDE Mobile App — WebSocket connection manager
 * Connects to the desktop daemon via relay or direct LAN
 */

import { create } from 'zustand';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolName?: string;
  isError?: boolean;
}

export interface Session {
  id: string;
  title: string;
  workingDirectory: string;
  providerId: string;
  model: string;
  updatedAt: number;
}

export interface ApprovalRequest {
  id: string;
  toolName: string;
  description: string;
  command?: string;
  filePath?: string;
}

interface ConnectionStore {
  status: ConnectionStatus;
  relayUrl: string | null;
  token: string | null;
  ws: WebSocket | null;
  desktopOnline: boolean;
  sessions: Session[];
  activeSessionId: string | null;
  messages: AgentMessage[];
  pendingApproval: ApprovalRequest | null;
  streamingContent: string;
  error: string | null;

  connect: (relayUrl: string, token: string) => void;
  disconnect: () => void;
  sendMessage: (text: string) => void;
  cancelAgent: () => void;
  respondApproval: (id: string, approved: boolean) => void;
  selectSession: (sessionId: string) => void;
  loadSessions: () => void;
  clearMessages: () => void;
}

function rpc(ws: WebSocket, method: string, params: Record<string, unknown>): void {
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }));
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  status: 'disconnected',
  relayUrl: null,
  token: null,
  ws: null,
  desktopOnline: false,
  sessions: [],
  activeSessionId: null,
  messages: [],
  pendingApproval: null,
  streamingContent: '',
  error: null,

  connect(relayUrl: string, token: string) {
    const existing = get().ws;
    if (existing) existing.close();

    set({ status: 'connecting', relayUrl, token, error: null });

    const ws = new WebSocket(`${relayUrl}?token=${token}&role=mobile`);

    ws.onopen = () => {
      set({ status: 'connected', ws });
      rpc(ws, 'session.list', {});
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as Record<string, unknown>;

        // JSON-RPC response
        if ('result' in msg) {
          const result = msg.result;
          if (Array.isArray(result) && result.length > 0 && 'workingDirectory' in (result[0] as object)) {
            set({ sessions: result as Session[] });
          }
          return;
        }

        // Event
        const event = msg.event as string;
        const data = msg.data as Record<string, unknown>;

        switch (event) {
          case 'relay.connected':
            set({ desktopOnline: Boolean(data.desktopOnline) });
            break;

          case 'desktop.connected':
            set({ desktopOnline: true });
            rpc(ws, 'session.list', {});
            break;

          case 'desktop.disconnected':
            set({ desktopOnline: false });
            break;

          case 'agent.content':
            set((s) => ({ streamingContent: s.streamingContent + String(data.delta ?? '') }));
            break;

          case 'agent.done': {
            const content = String(data.content ?? '');
            const msg: AgentMessage = {
              id: String(Date.now()),
              role: 'assistant',
              content,
              timestamp: Date.now(),
            };
            set((s) => ({
              messages: [...s.messages, msg],
              streamingContent: '',
            }));
            break;
          }

          case 'agent.tool_start': {
            const call = data.call as { name: string };
            const toolMsg: AgentMessage = {
              id: String(Date.now()),
              role: 'tool',
              content: `Running: ${call?.name ?? 'tool'}`,
              timestamp: Date.now(),
              toolName: call?.name,
            };
            set((s) => ({ messages: [...s.messages, toolMsg] }));
            break;
          }

          case 'approval_request':
            set({ pendingApproval: data as unknown as ApprovalRequest });
            break;

          case 'agent.error':
            set((s) => ({
              messages: [...s.messages, {
                id: String(Date.now()),
                role: 'assistant',
                content: `Error: ${String(data.error ?? 'Unknown error')}`,
                timestamp: Date.now(),
                isError: true,
              }],
              streamingContent: '',
            }));
            break;
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => set({ status: 'error', error: 'Connection failed' });
    ws.onclose = () => set({ status: 'disconnected', ws: null, desktopOnline: false });
  },

  disconnect() {
    get().ws?.close();
    set({ status: 'disconnected', ws: null, desktopOnline: false });
  },

  sendMessage(text: string) {
    const { ws, activeSessionId } = get();
    if (!ws || !activeSessionId) return;
    const userMsg: AgentMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], streamingContent: '' }));
    rpc(ws, 'agent.run', { sessionId: activeSessionId, message: text });
  },

  cancelAgent() {
    const { ws } = get();
    if (ws) rpc(ws, 'agent.cancel', {});
  },

  respondApproval(id: string, approved: boolean) {
    const { ws } = get();
    if (ws) rpc(ws, 'approval.respond', { id, approved });
    set({ pendingApproval: null });
  },

  selectSession(sessionId: string) {
    set({ activeSessionId: sessionId, messages: [], streamingContent: '' });
  },

  loadSessions() {
    const { ws } = get();
    if (ws) rpc(ws, 'session.list', {});
  },

  clearMessages() {
    set({ messages: [], streamingContent: '' });
  },
}));
