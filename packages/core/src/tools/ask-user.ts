import { askUserDefinition } from './definitions-extra.js';
import { EventEmitter } from 'node:events';

const pendingQuestions = new Map<string, { resolve: (answer: string) => void }>();
let questionCounter = 0;

export const askUserEvents = new EventEmitter();

export const askUserTool = {
  definition: askUserDefinition,

  async execute(args: Record<string, unknown>): Promise<string> {
    const question = args.question as string;
    const options = args.options as Array<{ label: string; description?: string }>;
    const multiSelect = (args.multiSelect as boolean) || false;

    const id = `question_${++questionCounter}`;

    askUserEvents.emit('question', {
      id,
      question,
      options,
      multiSelect,
    });

    return new Promise((resolve) => {
      pendingQuestions.set(id, { resolve });

      setTimeout(() => {
        if (pendingQuestions.has(id)) {
          pendingQuestions.delete(id);
          resolve('(User did not respond within timeout)');
        }
      }, 300000);
    });
  },
};

export function respondToQuestion(id: string, answer: string): boolean {
  const pending = pendingQuestions.get(id);
  if (!pending) return false;
  pending.resolve(answer);
  pendingQuestions.delete(id);
  return true;
}
