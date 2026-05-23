import { EventEmitter } from 'node:events';

export interface Notification {
  id: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export class NotificationManager extends EventEmitter {
  private notifications: Notification[] = [];
  private counter = 0;

  push(message: string): Notification {
    const notification: Notification = {
      id: `notif_${++this.counter}`,
      message,
      timestamp: Date.now(),
      read: false,
    };
    this.notifications.push(notification);
    this.emit('push', notification);
    return notification;
  }

  markRead(id: string): void {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.emit('read', notif);
    }
  }

  markAllRead(): void {
    for (const notif of this.notifications) {
      notif.read = true;
    }
    this.emit('allRead');
  }

  unread(): Notification[] {
    return this.notifications.filter((n) => !n.read);
  }

  recent(count = 20): Notification[] {
    return this.notifications.slice(-count);
  }

  clear(): void {
    this.notifications = [];
    this.emit('cleared');
  }
}
