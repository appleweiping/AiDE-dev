/**
 * Project indexer: scans files, chunks them, and builds a TF-IDF index.
 * Supports incremental re-indexing based on file modification times.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { readFile, stat, readdir, mkdir, writeFile } from 'node:fs/promises';
import { chunkFile, detectLanguage } from './chunker.js';
import type { Chunk } from './chunker.js';
import {
  createIndex,
  addDocument,
  removeDocument,
  search as tfidfSearch,
  serializeIndex,
  deserializeIndex,
} from './tfidf.js';
import type { TfIdfIndex, SerializedIndex } from './tfidf.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface IndexOptions {
  /** Chunk size in approximate tokens. Default: 512 */
  chunkSize?: number;
  /** Overlap between chunks in approximate tokens. Default: 50 */
  overlap?: number;
  /** File extensions to include. Default: common code extensions */
  includeExtensions?: string[];
  /** Glob-style patterns to exclude (matched against relative paths). Default: common ignores */
  excludePatterns?: string[];
  /** Where to persist the index. Default: <rootDir>/.aide/index.json */
  indexPath?: string;
}

export interface IndexStats {
  filesIndexed: number;
  filesSkipped: number;
  chunksTotal: number;
  durationMs: number;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'rs', 'go', 'java', 'kt', 'cs',
  'cpp', 'cc', 'c', 'h', 'hpp',
  'rb', 'php', 'swift',
  'md', 'txt', 'json', 'yaml', 'yml', 'toml',
  'sh', 'bash', 'zsh', 'sql',
  'html', 'css', 'scss', 'less',
]);

const DEFAULT_EXCLUDE = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '__pycache__',
  '.cache',
  '.aide',
  'target',        // Rust
  'vendor',        // Go / PHP
  '.venv',
  'venv',
  'env',
  '.env',
  'coverage',
  '.nyc_output',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'Cargo.lock',
];

// ---------------------------------------------------------------------------
// Persisted state
// ---------------------------------------------------------------------------

interface PersistedState {
  /** Map from file path to last-indexed mtime (ms) */
  mtimes: Record<string, number>;
  /** Map from chunk id to Chunk metadata (without content for size) */
  chunks: Record<string, Omit<Chunk, 'content'>>;
  /** Map from chunk id to content (stored separately for search) */
  contents: Record<string, string>;
  /** TF-IDF index */
  tfidf: SerializedIndex;
}

// ---------------------------------------------------------------------------
// Indexer class
// ---------------------------------------------------------------------------

export class ProjectIndexer {
  private rootDir: string;
  private options: Required<IndexOptions>;
  private tfidf: TfIdfIndex;
  /** chunk id -> Chunk (with content) */
  private chunks = new Map<string, Chunk>();
  /** file path -> mtime */
  private mtimes = new Map<string, number>();
  private indexPath: string;

  constructor(rootDir: string, options: IndexOptions = {}) {
    this.rootDir = path.resolve(rootDir);
    this.indexPath =
      options.indexPath ?? path.join(this.rootDir, '.aide', 'index.json');
    this.options = {
      chunkSize: options.chunkSize ?? 512,
      overlap: options.overlap ?? 50,
      includeExtensions: options.includeExtensions ?? Array.from(DEFAULT_EXTENSIONS),
      excludePatterns: options.excludePatterns ?? DEFAULT_EXCLUDE,
      indexPath: this.indexPath,
    };
    this.tfidf = createIndex();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Index (or incrementally re-index) the project.
   */
  async indexProject(options?: Partial<IndexOptions>): Promise<IndexStats> {
    if (options) {
      Object.assign(this.options, options);
    }

    const start = Date.now();

    // Load persisted state if available
    await this.loadState();

    const extSet = new Set(this.options.includeExtensions);
    const excludeSet = new Set(this.options.excludePatterns);

    let filesIndexed = 0;
    let filesSkipped = 0;

    // Collect all eligible files
    const allFiles: string[] = [];
    await this.walkDir(this.rootDir, extSet, excludeSet, allFiles);

    // Detect deleted files
    const allFileSet = new Set(allFiles);
    for (const [filePath] of this.mtimes) {
      if (!allFileSet.has(filePath)) {
        this.removeFileChunks(filePath);
      }
    }

    // Index new/changed files
    for (const filePath of allFiles) {
      let fileStat: fs.Stats;
      try {
        fileStat = await stat(filePath);
      } catch {
        filesSkipped++;
        continue;
      }

      const mtime = fileStat.mtimeMs;
      const prevMtime = this.mtimes.get(filePath);

      if (prevMtime !== undefined && prevMtime === mtime) {
        filesSkipped++;
        continue;
      }

      // Re-index this file
      try {
        await this.indexFile(filePath);
        this.mtimes.set(filePath, mtime);
        filesIndexed++;
      } catch {
        filesSkipped++;
      }
    }

    // Persist updated state
    await this.saveState();

    return {
      filesIndexed,
      filesSkipped,
      chunksTotal: this.chunks.size,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Search the index for chunks relevant to the query.
   */
  search(query: string, topK = 10): SearchResult[] {
    const hits = tfidfSearch(this.tfidf, query, topK);
    const results: SearchResult[] = [];

    for (const hit of hits) {
      const chunk = this.chunks.get(hit.id);
      if (chunk) {
        results.push({ chunk, score: hit.score });
      }
    }

    return results;
  }

  /**
   * Clear the entire index.
   */
  clear(): void {
    this.tfidf = createIndex();
    this.chunks.clear();
    this.mtimes.clear();
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async indexFile(filePath: string): Promise<void> {
    // Remove old chunks for this file
    this.removeFileChunks(filePath);

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      return; // binary or unreadable
    }

    // Skip very large files (> 1 MB)
    if (content.length > 1_000_000) return;

    const newChunks = chunkFile(content, filePath, {
      chunkSize: this.options.chunkSize,
      overlap: this.options.overlap,
    });

    for (const chunk of newChunks) {
      const id = chunkId(chunk);
      this.chunks.set(id, chunk);
      addDocument(this.tfidf, id, chunk.content);
    }
  }

  private removeFileChunks(filePath: string): void {
    for (const [id, chunk] of this.chunks) {
      if (chunk.filePath === filePath) {
        removeDocument(this.tfidf, id);
        this.chunks.delete(id);
      }
    }
    this.mtimes.delete(filePath);
  }

  private async walkDir(
    dir: string,
    extSet: Set<string>,
    excludeSet: Set<string>,
    results: string[],
  ): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(this.rootDir, fullPath);

      // Check exclusions
      if (this.isExcluded(entry.name, relPath, excludeSet)) continue;

      if (entry.isDirectory()) {
        await this.walkDir(fullPath, extSet, excludeSet, results);
      } else if (entry.isFile()) {
        const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
        if (extSet.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  private isExcluded(name: string, relPath: string, excludeSet: Set<string>): boolean {
    if (excludeSet.has(name)) return true;
    // Check if any path segment matches
    const parts = relPath.split(path.sep);
    for (const part of parts) {
      if (excludeSet.has(part)) return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private async loadState(): Promise<void> {
    try {
      const raw = await readFile(this.indexPath, 'utf-8');
      const state: PersistedState = JSON.parse(raw);

      this.mtimes = new Map(Object.entries(state.mtimes));
      this.tfidf = deserializeIndex(state.tfidf);

      // Reconstruct chunks
      this.chunks.clear();
      for (const [id, meta] of Object.entries(state.chunks)) {
        const content = state.contents[id] ?? '';
        this.chunks.set(id, { ...meta, content });
      }
    } catch {
      // No existing state — start fresh
    }
  }

  private async saveState(): Promise<void> {
    const dir = path.dirname(this.indexPath);
    await mkdir(dir, { recursive: true });

    const chunkMeta: Record<string, Omit<Chunk, 'content'>> = {};
    const contents: Record<string, string> = {};

    for (const [id, chunk] of this.chunks) {
      const { content, ...meta } = chunk;
      chunkMeta[id] = meta;
      contents[id] = content;
    }

    const state: PersistedState = {
      mtimes: Object.fromEntries(this.mtimes),
      chunks: chunkMeta,
      contents,
      tfidf: serializeIndex(this.tfidf),
    };

    await writeFile(this.indexPath, JSON.stringify(state), 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkId(chunk: Chunk): string {
  return `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`;
}

// ---------------------------------------------------------------------------
// Module-level convenience functions
// ---------------------------------------------------------------------------

let _defaultIndexer: ProjectIndexer | null = null;

/**
 * Index a project directory. Creates or reuses a module-level indexer.
 */
export async function indexProject(
  rootDir: string,
  options?: IndexOptions,
): Promise<IndexStats> {
  _defaultIndexer = new ProjectIndexer(rootDir, options);
  return _defaultIndexer.indexProject();
}

/**
 * Search the most recently indexed project.
 */
export function searchIndex(query: string, topK = 10): SearchResult[] {
  if (!_defaultIndexer) {
    throw new Error('No project has been indexed yet. Call indexProject() first.');
  }
  return _defaultIndexer.search(query, topK);
}
