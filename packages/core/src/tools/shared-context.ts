import type { ToolDefinition } from '@aide/shared';
import type { ToolResult } from './registry.js';
import type { SharedContext, SubAgentManager } from '../agent/sub-agent.js';

export function createSharedReadTool(sharedContext: SharedContext): ToolDefinition & { execute: (args: Record<string, unknown>) => Promise<ToolResult> } {
  return {
    name: 'shared_read',
    description: 'Read a value from the shared context accessible by all agents in this session.',
    parameters: {
      type: 'object',
      properties: { key: { type: 'string', description: 'Key to read' } },
      required: ['key'],
    },
    async execute(args) {
      const value = sharedContext.get(args.key as string);
      return { output: value !== undefined ? JSON.stringify(value) : 'undefined', isError: false };
    },
  };
}

export function createSharedWriteTool(sharedContext: SharedContext): ToolDefinition & { execute: (args: Record<string, unknown>) => Promise<ToolResult> } {
  return {
    name: 'shared_write',
    description: 'Write a value to the shared context accessible by all agents in this session.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to write' },
        value: { type: 'string', description: 'Value to store (as JSON string)' },
      },
      required: ['key', 'value'],
    },
    async execute(args) {
      let parsed: unknown;
      try { parsed = JSON.parse(args.value as string); } catch { parsed = args.value; }
      sharedContext.set(args.key as string, parsed);
      return { output: `Stored "${args.key}" in shared context.`, isError: false };
    },
  };
}

export function createSendMessageTool(
  subAgentManager: SubAgentManager,
  currentAgentId: string,
): ToolDefinition & { execute: (args: Record<string, unknown>) => Promise<ToolResult> } {
  return {
    name: 'send_message',
    description: 'Send a message to another sub-agent or to the parent agent (use "parent" as the target ID).',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Target agent ID or "parent"' },
        message: { type: 'string', description: 'Message content' },
      },
      required: ['to', 'message'],
    },
    async execute(args) {
      subAgentManager.sendMessage(currentAgentId, args.to as string, args.message as string);
      return { output: `Message sent to "${args.to}".`, isError: false };
    },
  };
}
