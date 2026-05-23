import { EventEmitter } from 'node:events';

export type PlanPhase = 'exploring' | 'designing' | 'reviewing' | 'ready';

export interface PlanStep {
  id: string;
  description: string;
  files: string[];
  status: 'pending' | 'in_progress' | 'completed';
}

export interface Plan {
  id: string;
  title: string;
  context: string;
  phase: PlanPhase;
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
}

export class PlanManager extends EventEmitter {
  private currentPlan: Plan | null = null;

  get active(): Plan | null {
    return this.currentPlan;
  }

  get isInPlanMode(): boolean {
    return this.currentPlan !== null && this.currentPlan.phase !== 'ready';
  }

  enter(title: string, context: string): Plan {
    this.currentPlan = {
      id: `plan_${Date.now()}`,
      title,
      context,
      phase: 'exploring',
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.emit('enter', this.currentPlan);
    return this.currentPlan;
  }

  setPhase(phase: PlanPhase): void {
    if (!this.currentPlan) return;
    this.currentPlan.phase = phase;
    this.currentPlan.updatedAt = Date.now();
    this.emit('phaseChange', phase);
  }

  addStep(description: string, files: string[] = []): PlanStep {
    if (!this.currentPlan) throw new Error('No active plan');
    const step: PlanStep = {
      id: `step_${this.currentPlan.steps.length + 1}`,
      description,
      files,
      status: 'pending',
    };
    this.currentPlan.steps.push(step);
    this.currentPlan.updatedAt = Date.now();
    this.emit('stepAdded', step);
    return step;
  }

  updateStep(stepId: string, status: PlanStep['status']): void {
    if (!this.currentPlan) return;
    const step = this.currentPlan.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = status;
      this.currentPlan.updatedAt = Date.now();
      this.emit('stepUpdated', step);
    }
  }

  exit(): Plan | null {
    const plan = this.currentPlan;
    if (plan) {
      plan.phase = 'ready';
      plan.updatedAt = Date.now();
      this.emit('exit', plan);
    }
    this.currentPlan = null;
    return plan;
  }

  toJSON(): object | null {
    return this.currentPlan;
  }
}
