/**
 * session/sqlite-store.ts
 *
 * SQLite-backed session storage — a drop-in replacement for SessionManager.
 *
 * Schema
 * ──────
 * sessions (id, title, working_directory, provider_id, model, created_at, updated_at)
 * messages (id, session_id, role, content, tool_calls_json, tool_results_json,
 *           reasoning, timestamp)
 * messages_fts  — FTS5 virtual table over messages.content
 *
 * Migration
 * ─────────
 * Call `SqliteSessionStore.migrateFromJson(jsonSessionsDir)` once to import
 * existing JSON sessions.  The method is idempotent (skips already-imported ids).
 */

import Database from 'better-sqlite3';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import type { Session, Message, ToolCall, ToolResult } from '@aide/shared';

// ---------------------------------------------------------------------------
// Re-export the same index-entry shape as SessionManager so callers can swap
// without changing their TypeScript types.
// ---------------------------------------------------------------------------

export interface SessionIndexEntry {
  id: string;
  title: string;
  workingDirectory: string;
  providerId: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  title: string;
  working_directory: string;
  provider_id: string;
  model: string;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  tool_calls_json: string | null;
  tool_results_json: string | null;
  reasoning: string | null;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// SqliteSessionStore
// ---------------------------------------------------------------------------

export class SqliteSessionStore {
  private db!: Database.Database;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = resolve(dbPath);
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  async init(): Promise<void> {
    // Ensure parent directory exists
    const dir = this.dbPath.substring(0, Math.max(this.dbPath.lastIndexOf('/'), this.dbPath.lastIndexOf('\\')));
    if (dir) await mkdir(dir, { recursive: true });

    this.db = new Database(this.dbPath);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.applySchema();
  }

  private applySchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        working_directory TEXT NOT NULL,
        provider_id      TEXT NOT NULL,
        model            TEXT NOT NULL,
        created_at       INTEGER NOT NULL,
        updated_at       INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);

      CREATE TABLE IF NOT EXISTS messages (
        id               TEXT PRIMARY KEY,
        session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role             TEXT NOT NULL,
        content          TEXT NOT NULL DEFAULT '',
        tool_calls_json  TEXT,
        tool_results_json TEXT,
        reasoning        TEXT,
        timestamp        INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp   ON messages(session_id, timestamp);

      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        content,
        session_id UNINDEXED,
        content='messages',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, content, session_id)
        VALUES (new.rowid, new.content, new.session_id);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, content, session_id)
        VALUES ('delete', old.rowid, old.content, old.session_id);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, content, session_id)
        VALUES ('delete', old.rowid, old.content, old.session_id);
        INSERT INTO messages_fts(rowid, content, session_id)
        VALUES (new.rowid, new.content, new.session_id);
      END;
    `);
  }

  // -------------------------------------------------------------------------
  // CRUD — sessions
  // -------------------------------------------------------------------------

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

    this.db
      .prepare(
        `INSERT INTO sessions (id, title, working_directory, provider_id, model, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.title,
        session.workingDirectory,
        session.providerId,
        session.model,
        session.createdAt,
        session.updatedAt,
      );

    return session;
  }

  async get(id: string): Promise<Session | null> {
    const row = this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(id) as SessionRow | undefined;

    if (!row) return null;

    const messages = this.loadMessages(id);
    return rowToSession(row, messages);
  }

  async update(session: Session): Promise<void> {
    session.updatedAt = Date.now();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE sessions
           SET title = ?, working_directory = ?, provider_id = ?, model = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          session.title,
          session.workingDirectory,
          session.providerId,
          session.model,
          session.updatedAt,
          session.id,
        );

      // Replace all messages for this session
      this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(session.id);
      this.insertMessages(session.id, session.messages);
    });

    tx();
  }

  async appendMessage(sessionId: string, message: Message): Promise<Session | null> {
    const session = await this.get(sessionId);
    if (!session) return null;
    session.messages.push(message);
    await this.update(session);
    return session;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async list(): Promise<SessionIndexEntry[]> {
    const rows = this.db
      .prepare('SELECT * FROM sessions ORDER BY updated_at DESC')
      .all() as SessionRow[];
    return rows.map(rowToIndexEntry);
  }

  async rename(id: string, title: string): Promise<boolean> {
    const result = this.db
      .prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, Date.now(), id);
    return result.changes > 0;
  }

  async clearMessages(id: string): Promise<boolean> {
    const exists = this.db
      .prepare('SELECT id FROM sessions WHERE id = ?')
      .get(id);
    if (!exists) return false;

    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
      this.db
        .prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
        .run(Date.now(), id);
    });
    tx();
    return true;
  }

  // -------------------------------------------------------------------------
  // Full-text search
  // -------------------------------------------------------------------------

  /**
   * Search message content across all sessions (or a specific session).
   * Returns matching messages with their session ids.
   */
  searchMessages(
    query: string,
    options: { sessionId?: string; limit?: number } = {},
  ): Array<{ sessionId: string; message: Message }> {
    const limit = options.limit ?? 50;

    let sql: string;
    let params: unknown[];

    if (options.sessionId) {
      sql = `
        SELECT m.*
        FROM messages m
        JOIN messages_fts fts ON m.rowid = fts.rowid
        WHERE messages_fts MATCH ?
          AND m.session_id = ?
        ORDER BY rank
        LIMIT ?
      `;
      params = [query, options.sessionId, limit];
    } else {
      sql = `
        SELECT m.*
        FROM messages m
        JOIN messages_fts fts ON m.rowid = fts.rowid
        WHERE messages_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;
      params = [query, limit];
    }

    const rows = this.db.prepare(sql).all(...params) as MessageRow[];
    return rows.map((row) => ({
      sessionId: row.session_id,
      message: rowToMessage(row),
    }));
  }

  // -------------------------------------------------------------------------
  // Migration from JSON files
  // -------------------------------------------------------------------------

  /**
   * Import sessions from a JSON-file-based SessionManager directory.
   * Idempotent — sessions already in the DB are skipped.
   *
   * @param jsonDir  The directory that contains `<sessionId>.json` files.
   */
  async migrateFromJson(jsonDir: string): Promise<{ imported: number; skipped: number }> {
    const dir = resolve(jsonDir);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return { imported: 0, skipped: 0 };
    }

    const jsonFiles = files.filter(
      (f) => f.endsWith('.json') && f !== 'index.json',
    );

    let imported = 0;
    let skipped = 0;

    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(dir, file), 'utf-8');
        const session = JSON.parse(raw) as Session;

        // Skip if already imported
        const exists = this.db
          .prepare('SELECT id FROM sessions WHERE id = ?')
          .get(session.id);
        if (exists) {
          skipped++;
          continue;
        }

        const tx = this.db.transaction(() => {
          this.db
            .prepare(
              `INSERT INTO sessions (id, title, working_directory, provider_id, model, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              session.id,
              session.title,
              session.workingDirectory,
              session.providerId,
              session.model,
              session.createdAt,
              session.updatedAt,
            );

          this.insertMessages(session.id, session.messages ?? []);
        });

        tx();
        imported++;
      } catch {
        // Skip malformed files
        skipped++;
      }
    }

    return { imported, skipped };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Close the database connection. Call on process exit. */
  close(): void {
    if (this.db?.open) {
      this.db.close();
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private loadMessages(sessionId: string): Message[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
      )
      .all(sessionId) as MessageRow[];
    return rows.map(rowToMessage);
  }

  private insertMessages(sessionId: string, messages: Message[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO messages (id, session_id, role, content, tool_calls_json, tool_results_json, reasoning, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const msg of messages) {
      stmt.run(
        randomUUID(),
        sessionId,
        msg.role,
        msg.content ?? '',
        msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
        msg.toolResults ? JSON.stringify(msg.toolResults) : null,
        msg.reasoning ?? null,
        msg.timestamp ?? Date.now(),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Row → domain object converters
// ---------------------------------------------------------------------------

function rowToSession(row: SessionRow, messages: Message[]): Session {
  return {
    id: row.id,
    title: row.title,
    workingDirectory: row.working_directory,
    providerId: row.provider_id,
    model: row.model,
    messages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToIndexEntry(row: SessionRow): SessionIndexEntry {
  return {
    id: row.id,
    title: row.title,
    workingDirectory: row.working_directory,
    providerId: row.provider_id,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMessage(row: MessageRow): Message {
  let toolCalls: ToolCall[] | undefined;
  let toolResults: ToolResult[] | undefined;

  try {
    if (row.tool_calls_json) toolCalls = JSON.parse(row.tool_calls_json) as ToolCall[];
  } catch {}

  try {
    if (row.tool_results_json) toolResults = JSON.parse(row.tool_results_json) as ToolResult[];
  } catch {}

  return {
    role: row.role as Message['role'],
    content: row.content,
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    ...(toolResults && toolResults.length > 0 ? { toolResults } : {}),
    ...(row.reasoning ? { reasoning: row.reasoning } : {}),
    timestamp: row.timestamp,
  };
}
