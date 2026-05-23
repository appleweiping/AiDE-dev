import type { ProviderMessage } from '../provider/types.js';

export interface CompactionResult {
  messages: ProviderMessage[];
  removedCount: number;
  savedTokens: number;
}

export function compactContext(
  messages: ProviderMessage[],
  maxTokens: number,
  estimateTokens: (msg: ProviderMessage) => number
): CompactionResult {
  const totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);

  if (totalTokens <= maxTokens) {
    return { messages, removedCount: 0, savedTokens: 0 };
  }

  const systemMessages = messages.filter((m) => m.role === 'system');
  const conversationMessages = messages.filter((m) => m.role !== 'system');

  if (conversationMessages.length <= 4) {
    return { messages, removedCount: 0, savedTokens: 0 };
  }

  const recentCount = Math.min(6, Math.floor(conversationMessages.length * 0.3));
  const recentMessages = conversationMessages.slice(-recentCount);
  const olderMessages = conversationMessages.slice(0, -recentCount);

  const summary = summarizeMessages(olderMessages);
  const summaryMessage: ProviderMessage = {
    role: 'system',
    content: `[Context Summary]\n${summary}`,
  };

  const compacted = [...systemMessages, summaryMessage, ...recentMessages];
  const savedTokens = totalTokens - compacted.reduce((sum, msg) => sum + estimateTokens(msg), 0);

  return {
    messages: compacted,
    removedCount: olderMessages.length,
    savedTokens: Math.max(0, savedTokens),
  };
}

function summarizeMessages(messages: ProviderMessage[]): string {
  const points: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      const content = typeof msg.content === 'string' ? msg.content : '';
      if (content.length > 0) {
        points.push(`User asked: ${content.slice(0, 200)}`);
      }
    } else if (msg.role === 'assistant') {
      const content = typeof msg.content === 'string' ? msg.content : '';
      if (content.length > 100) {
        points.push(`Assistant: ${content.slice(0, 200)}`);
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const toolNames = msg.tool_calls.map((tc) => tc.function.name).join(', ');
        points.push(`Tools used: ${toolNames}`);
      }
    }
  }

  if (points.length > 20) {
    return points.slice(0, 5).join('\n') + '\n...\n' + points.slice(-10).join('\n');
  }

  return points.join('\n');
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export function estimateMessageTokens(msg: ProviderMessage): number {
  let tokens = 4; // message overhead
  if (typeof msg.content === 'string') {
    tokens += estimateTokenCount(msg.content);
  }
  if ('tool_calls' in msg && msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      tokens += estimateTokenCount(tc.function.name);
      tokens += estimateTokenCount(tc.function.arguments);
    }
  }
  return tokens;
}
