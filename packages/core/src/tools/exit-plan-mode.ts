import type { ToolDefinition } from '@aide/shared';
import type { ToolResult } from './registry.js';
import type { PlanManager } from '../plan/manager.js';

export function createExitPlanModeTool(planManager: PlanManager): ToolDefinition & { execute: (args: Record<string, unknown>) => Promise<ToolResult> } {
  return {
    name: 'exit_plan_mode',
    description: 'Exit plan mode and return to normal mode where file writes and shell commands are allowed.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_args) {
      const plan = planManager.exit();
      if (!plan) return { output: 'Not in plan mode.', isError: false };
      const stepSummary = plan.steps.length > 0
        ? `\n\nPlan steps:\n${plan.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}`
        : '';
      return { output: `Exited plan mode. File writes and shell commands are now allowed.${stepSummary}`, isError: false };
    },
  };
}
