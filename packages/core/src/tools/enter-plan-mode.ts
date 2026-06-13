import type { ToolDefinition } from '@aide/shared';
import type { ToolResult } from './registry.js';
import type { PlanManager } from '../plan/manager.js';

export function createEnterPlanModeTool(planManager: PlanManager): ToolDefinition & { execute: (args: Record<string, unknown>) => Promise<ToolResult> } {
  return {
    name: 'enter_plan_mode',
    description: 'Enter plan mode. In plan mode, file writes and shell commands are blocked. Use this to safely explore the codebase and design a solution before making changes.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for this plan' },
        context: { type: 'string', description: 'Context or goal for the plan' },
      },
      required: ['title'],
    },
    async execute(args) {
      const plan = planManager.enter(args.title as string, (args.context as string) ?? '');
      return { output: `Entered plan mode: "${plan.title}". File writes and shell commands are now blocked. Use exit_plan_mode when ready to implement.`, isError: false };
    },
  };
}
