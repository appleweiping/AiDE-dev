import { cronDefinition } from './definitions-extra.js';

interface CronJob {
  id: string;
  cron: string;
  prompt: string;
  recurring: boolean;
  nextFire: number;
  createdAt: number;
}

const jobs = new Map<string, CronJob>();
let jobCounter = 0;

export const cronTool = {
  definition: cronDefinition,

  async execute(args: Record<string, unknown>): Promise<string> {
    const operation = args.operation as string;

    switch (operation) {
      case 'create': {
        const cron = args.cron as string;
        const prompt = args.prompt as string;
        const recurring = args.recurring !== false;

        if (!cron || !prompt) {
          return 'Error: cron and prompt are required for create';
        }

        if (!isValidCron(cron)) {
          return `Error: Invalid cron expression: ${cron}`;
        }

        const id = `cron_${++jobCounter}`;
        const job: CronJob = {
          id,
          cron,
          prompt,
          recurring,
          nextFire: getNextFireTime(cron),
          createdAt: Date.now(),
        };
        jobs.set(id, job);

        return `Scheduled job ${id}\nCron: ${cron}\nRecurring: ${recurring}\nNext fire: ${new Date(job.nextFire).toLocaleString()}`;
      }

      case 'delete': {
        const jobId = args.jobId as string;
        if (!jobId) return 'Error: jobId is required for delete';
        if (!jobs.has(jobId)) return `Error: Job ${jobId} not found`;
        jobs.delete(jobId);
        return `Deleted job ${jobId}`;
      }

      case 'list': {
        if (jobs.size === 0) return 'No scheduled jobs';
        return Array.from(jobs.values())
          .map((j) => `${j.id}: "${j.cron}" ${j.recurring ? '(recurring)' : '(one-shot)'}\n  Prompt: ${j.prompt.slice(0, 80)}`)
          .join('\n\n');
      }

      default:
        return `Error: Unknown operation: ${operation}`;
    }
  },
};

function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  return parts.length === 5;
}

function getNextFireTime(cron: string): number {
  const parts = cron.trim().split(/\s+/);
  const now = new Date();
  const minute = parts[0] === '*' ? now.getMinutes() + 1 : parseInt(parts[0]);
  const hour = parts[1] === '*' ? now.getHours() : parseInt(parts[1]);

  const next = new Date(now);
  next.setMinutes(minute);
  next.setHours(hour);
  next.setSeconds(0);
  next.setMilliseconds(0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime();
}

export function getJobs(): CronJob[] {
  return Array.from(jobs.values());
}

export function checkAndFireJobs(): CronJob[] {
  const now = Date.now();
  const fired: CronJob[] = [];

  for (const job of jobs.values()) {
    if (now >= job.nextFire) {
      fired.push(job);
      if (job.recurring) {
        job.nextFire = getNextFireTime(job.cron);
      } else {
        jobs.delete(job.id);
      }
    }
  }

  return fired;
}
