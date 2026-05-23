import { readFile, writeFile, readdir, mkdir, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Session, Message, ProviderConfig } from '@aide/shared';

// ---------------------------------------------------------------------------
// SessionManager
//
// Persists sessions as JSON files under a configurable directory.
// File layout:
//   <sessionsDir>/
//     <sessionId>.json   — full session data
//     index.json         — lightweight index for listing (id, title, updatedAt)
// ---------------------------------------------------------------------------

interface SessionIndex {
  sessions: SessionIndexEntry[];
}

interface SessionIndexEntry {
  id: string;
  title: string;
  workingDirectory: string;
  providerId: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string;
}

export class SessionManager {
  private sessionsDir: string;
  private indexPath: string;

  constructor(sessionsDir: string) {
    this.sessionsDir = resolve(sessionsDir);
    this.indexPath = join(this.sessionsDir, 'index.json');
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  async init(): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
    // Create empty index if it doesn't exist
    try {
      await readFile(this.indexPath, 'utf-8');
    } catch {
      await this.writeIndex({ sessions: [] });
    }
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /** Create a new session and persist it. */
  async create(params: {
    title?: string;
    workingDirectory: string;
    providerId: string;
    model: string;
  }): Promise<Session> {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      title: params.title ?? `Session ${new Date(now).toLocaleString()}`,
      workingDirectory: params.workingDirectory,
      providerId: params.providerId,
      model: params.model,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.writeSession(session);
    await this.addToIndex(session);
    return session;
  }

  /** Load a session by id. Returns null if not found. */
  async get(id: string): Promise<Session | null> {
    const filePath = this.sessionPath(id);
    try {
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }

  /** Update a session (replaces the full record). */
  async update(session: Session): Promise<void> {
    session.updatedAt = Date.now();
    await this.writeSession(session);
    await this.updateIndex(session);
  }

  /** Append a message to a session and persist. */
  async appendMessage(sessionId: string, message: Message): Promise<Session | null> {
    const session = await this.get(sessionId);
    if (!session) return null;
    session.messages.push(message);
    await this.update(session);
    return session;
  }

  /** Delete a session by id. Returns true if deleted, false if not found. */
  async delete(id: string): Promise<boolean> {
    const filePath = this.sessionPath(id);
    try {
      await unlink(filePath);
    } catch {
      return false;
    }
    await this.removeFromIndex(id);
    return true;
  }

  /** List all sessions (lightweight, from index). */
  async list(): Promise<SessionIndexEntry[]> {
    const index = await this.readIndex();
    // Sort by updatedAt descending
    return [...index.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Update the title of a session. */
  async rename(id: string, title: string): Promise<boolean> {
    const session = await this.get(id);
    if (!session) return false;
    session.title = title;
    await this.update(session);
    return true;
  }

  /** Clear all messages from a session (keep metadata). */
  async clearMessages(id: string): Promise<boolean> {
    const session = await this.get(id);
    if (!session) return false;
    session.messages = [];
    await this.update(session);
    return true;
  }

  /** Fork a session, optionally truncating its message history. */
  async fork(
    sessionId: string,
    options?: { title?: string; truncateAfterMessageIndex?: number },
  ): Promise<Session | null> {
    const original = await this.get(sessionId);
    if (!original) return null;

    const now = Date.now();
    const messages =
      options?.truncateAfterMessageIndex !== undefined
        ? original.messages.slice(0, options.truncateAfterMessageIndex + 1)
        : [...original.messages];

    const forked: Session = {
      ...original,
      id: randomUUID(),
      title: options?.title ?? `${original.title} (fork)`,
      parentId: original.id,
      messages,
      createdAt: now,
      updatedAt: now,
    };

    await this.writeSession(forked);
    await this.addToIndex(forked);
    return forked;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private sessionPath(id: string): string {
    // Sanitize id to prevent path traversal
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.sessionsDir, `${safe}.json`);
  }

  private async writeSession(session: Session): Promise<void> {
    await writeFile(this.sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
  }

  private async readIndex(): Promise<SessionIndex> {
    try {
      const raw = await readFile(this.indexPath, 'utf-8');
      return JSON.parse(raw) as SessionIndex;
    } catch {
      return { sessions: [] };
    }
  }

  private async writeIndex(index: SessionIndex): Promise<void> {
    await writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  private async addToIndex(session: Session): Promise<void> {
    const index = await this.readIndex();
    index.sessions.push(sessionToIndexEntry(session));
    await this.writeIndex(index);
  }

  private async updateIndex(session: Session): Promise<void> {
    const index = await this.readIndex();
    const i = index.sessions.findIndex((s) => s.id === session.id);
    if (i >= 0) {
      index.sessions[i] = sessionToIndexEntry(session);
    } else {
      index.sessions.push(sessionToIndexEntry(session));
    }
    await this.writeIndex(index);
  }

  private async removeFromIndex(id: string): Promise<void> {
    const index = await this.readIndex();
    index.sessions = index.sessions.filter((s) => s.id !== id);
    await this.writeIndex(index);
  }
}

function sessionToIndexEntry(session: Session): SessionIndexEntry {
  return {
    id: session.id,
    title: session.title,
    workingDirectory: session.workingDirectory,
    providerId: session.providerId,
    model: session.model,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ...(session.parentId ? { parentId: session.parentId } : {}),
  };
}
