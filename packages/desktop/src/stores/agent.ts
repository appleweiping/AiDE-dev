import { create } from 'zustand';
import type { Message, ToolCall, ToolResult } from '@aide/shared';

export interface ToolActivity {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  durationMs?: number;
  status: 'running' | 'done' | 'error';
  startedAt: number;
}

export interface StreamingState {
  isStreaming: boolean;
  currentContent: string;
  currentReasoning: string;
}

export interface AgentState {
  // Session
  currentSessionId: string | null;
  sessions: Array<{ id: string; title: string; updatedAt: number }>;

  // Messages
  messages: Message[];

  // Streaming
  streaming: StreamingState;

  // Tool activities (current turn)
  toolActivities: ToolActivity[];

  // Approval
  pendingApproval: {
    id: string;
    toolName: string;
    description: string;
    command?: string;
    filePath?: string;
  } | null;

  // Actions
  setCurrentSession: (sessionId: string | null) => void;
  setSessions: (sessions: Array<{ id: string; title: string; updatedAt: number }>) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  clearMessages: () => void;

  // Streaming actions
  startStreaming: () => void;
  appendContent: (delta: string) => void;
  appendReasoning: (delta: string) => void;
  stopStreaming: (finalContent?: string) => void;

  // Tool activity actions
  startToolActivity: (callId: string, name: string, args: Record<string, unknown>) => void;
  endToolActivity: (callId: string, result: string, isError: boolean, durationMs: number) => void;
  clearToolActivities: () => void;

  // Approval actions
  setPendingApproval: (approval: AgentState['pendingApproval']) => void;
  clearPendingApproval: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  currentSessionId: null,
  sessions: [],
  messages: [],
  streaming: {
    isStreaming: false,
    currentContent: '',
    currentReasoning: '',
  },
  toolActivities: [],
  pendingApproval: null,

  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

  setSessions: (sessions) => set({ sessions }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  clearMessages: () => set({ messages: [] }),

  startStreaming: () =>
    set({
      streaming: {
        isStreaming: true,
        currentContent: '',
        currentReasoning: '',
      },
      toolActivities: [],
    }),

  appendContent: (delta) =>
    set((state) => ({
      streaming: {
        ...state.streaming,
        currentContent: state.streaming.currentContent + delta,
      },
    })),

  appendReasoning: (delta) =>
    set((state) => ({
      streaming: {
        ...state.streaming,
        currentReasoning: state.streaming.currentReasoning + delta,
      },
    })),

  stopStreaming: (finalContent) => {
    const state = get();
    const content = finalContent ?? state.streaming.currentContent;

    if (content.trim()) {
      const assistantMessage: Message = {
        role: 'assistant',
        content,
        reasoning: state.streaming.currentReasoning || undefined,
        timestamp: Date.now(),
        toolCalls: state.toolActivities
          .filter((a) => a.status !== 'running')
          .map(
            (a): ToolCall => ({
              id: a.callId,
              name: a.name,
              arguments: a.args,
            }),
          ),
        toolResults: state.toolActivities
          .filter((a) => a.result !== undefined)
          .map(
            (a): ToolResult => ({
              callId: a.callId,
              content: a.result!,
              isError: a.isError ?? false,
            }),
          ),
      };
      set((s) => ({
        messages: [...s.messages, assistantMessage],
        streaming: { isStreaming: false, currentContent: '', currentReasoning: '' },
      }));
    } else {
      set({
        streaming: { isStreaming: false, currentContent: '', currentReasoning: '' },
      });
    }
  },

  startToolActivity: (callId, name, args) =>
    set((state) => ({
      toolActivities: [
        ...state.toolActivities,
        { callId, name, args, status: 'running', startedAt: Date.now() },
      ],
    })),

  endToolActivity: (callId, result, isError, durationMs) =>
    set((state) => ({
      toolActivities: state.toolActivities.map((a) =>
        a.callId === callId
          ? { ...a, result, isError, durationMs, status: isError ? 'error' : 'done' }
          : a,
      ),
    })),

  clearToolActivities: () => set({ toolActivities: [] }),

  setPendingApproval: (approval) => set({ pendingApproval: approval }),

  clearPendingApproval: () => set({ pendingApproval: null }),
}));
