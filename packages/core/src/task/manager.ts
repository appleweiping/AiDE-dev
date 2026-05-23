import { EventEmitter } from 'node:events';

export interface TaskItem {
  id: string;
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: number;
  completedAt?: number;
}

export class TaskManager extends EventEmitter {
  private tasks: TaskItem[] = [];
  private counter = 0;

  add(content: string, activeForm: string): TaskItem {
    const task: TaskItem = {
      id: `task_${++this.counter}`,
      content,
      activeForm,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.tasks.push(task);
    this.emit('added', task);
    return task;
  }

  update(id: string, status: TaskItem['status']): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    task.status = status;
    if (status === 'completed') task.completedAt = Date.now();
    this.emit('updated', task);
  }

  remove(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.emit('removed', id);
  }

  list(): TaskItem[] {
    return [...this.tasks];
  }

  replace(items: Array<{ content: string; activeForm: string; status: TaskItem['status'] }>): void {
    this.tasks = items.map((item) => ({
      id: `task_${++this.counter}`,
      content: item.content,
      activeForm: item.activeForm,
      status: item.status,
      createdAt: Date.now(),
      completedAt: item.status === 'completed' ? Date.now() : undefined,
    }));
    this.emit('replaced', this.tasks);
  }

  get current(): TaskItem | undefined {
    return this.tasks.find((t) => t.status === 'in_progress');
  }

  get pending(): TaskItem[] {
    return this.tasks.filter((t) => t.status === 'pending');
  }

  get completed(): TaskItem[] {
    return this.tasks.filter((t) => t.status === 'completed');
  }

  toJSON(): TaskItem[] {
    return this.tasks;
  }
}
