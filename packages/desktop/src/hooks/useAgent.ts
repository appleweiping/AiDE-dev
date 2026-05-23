import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAgentStore } from '../stores/agent';
import type {
  StreamContentEvent,
  StreamReasoningEvent,
  StreamToolStartEvent,
  StreamToolEndEvent,
  AgentDoneEvent,
  AgentErrorEvent,
  ApprovalRequestEvent,
} from '@aide/shared';

/**
 * Bridges Tauri events emitted by the sidecar to the agent Zustand store.
 * Must be mounted once at the app root level.
 */
export function useAgent() {
  const store = useAgentStore();

  useEffect(() => {
    const unlisten: Array<() => void> = [];

    async function setup() {
      // stream.content — assistant is generating text
      unlisten.push(
        await listen<StreamContentEvent>('stream.content', (event) => {
          if (!store.streaming.isStreaming) {
            store.startStreaming();
          }
          store.appendContent(event.payload.delta);
        }),
      );

      // stream.reasoning — assistant is thinking (extended thinking mode)
      unlisten.push(
        await listen<StreamReasoningEvent>('stream.reasoning', (event) => {
          if (!store.streaming.isStreaming) {
            store.startStreaming();
          }
          store.appendReasoning(event.payload.delta);
        }),
      );

      // stream.toolStart — a tool call has begun
      unlisten.push(
        await listen<StreamToolStartEvent>('stream.toolStart', (event) => {
          store.startToolActivity(
            event.payload.callId,
            event.payload.name,
            event.payload.args,
          );
        }),
      );

      // stream.toolEnd — a tool call has completed
      unlisten.push(
        await listen<StreamToolEndEvent>('stream.toolEnd', (event) => {
          store.endToolActivity(
            event.payload.callId,
            event.payload.result,
            event.payload.isError,
            event.payload.durationMs,
          );
        }),
      );

      // agent.done — the agent has finished its turn
      unlisten.push(
        await listen<AgentDoneEvent>('agent.done', (event) => {
          store.stopStreaming(event.payload.content);
          if (event.payload.sessionId && !store.currentSessionId) {
            store.setCurrentSession(event.payload.sessionId);
          }
        }),
      );

      // agent.error — the agent encountered an error
      unlisten.push(
        await listen<AgentErrorEvent>('agent.error', (event) => {
          store.stopStreaming();
          store.addMessage({
            role: 'assistant',
            content: `Error: ${event.payload.message}`,
            timestamp: Date.now(),
          });
        }),
      );

      // approval.request — the agent needs user approval for a tool
      unlisten.push(
        await listen<ApprovalRequestEvent>('approval.request', (event) => {
          store.setPendingApproval({
            id: event.payload.id,
            toolName: event.payload.toolName,
            description: event.payload.description,
            command: event.payload.command,
            filePath: event.payload.filePath,
          });
        }),
      );

      // sidecar.stopped — the Node.js process exited
      unlisten.push(
        await listen('sidecar.stopped', () => {
          store.stopStreaming();
          store.addMessage({
            role: 'system',
            content: 'Agent core process stopped.',
            timestamp: Date.now(),
          });
        }),
      );
    }

    setup().catch(console.error);

    return () => {
      unlisten.forEach((fn) => fn());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return store;
}
