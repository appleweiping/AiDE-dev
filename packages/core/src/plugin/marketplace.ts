/**
 * Plugin Marketplace Registry
 *
 * Fetches plugin listings from a remote registry (GitHub-based by default),
 * supports search/install/uninstall/update-check, and handles network errors
 * gracefully.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  mkdir,
  writeFile,
  readFile,
  rm,
  stat,
  readdir,
} from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  category: PluginCategory;
  /** Download URL (tarball or zip) */
  downloadUrl: string;
  /** Homepage / repository URL */
  homepage?: string;
  /** Number of downloads (for sorting) */
  downloads?: number;
  /** ISO date string of last publish */
  publishedAt?: string;
  /** Minimum AiDE version required */
  minAideVersion?: string;
}

export type PluginCategory =
  | 'tools'
  | 'providers'
  | 'themes'
  | 'languages'
  | 'integrations'
  | 'utilities'
  | 'other';

export interface MarketplaceOptions {
  /** Registry URL. Default: https://raw.githubusercontent.com/aide-dev/plugin-registry/main/registry.json */
  registryUrl?: string;
  /** Directory to install plugins into. Default: ~/.aide/plugins */
  pluginsDir?: string;
  /** HTTP request timeout in ms. Default: 15000 */
  timeoutMs?: number;
  /** Cache TTL for registry data in ms. Default: 5 minutes */
  cacheTtlMs?: number;
}

export interface InstallResult {
  pluginId: string;
  version: string;
  installedAt: string;
}

export interface UpdateInfo {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
}

// ---------------------------------------------------------------------------
// Internal registry cache
// ---------------------------------------------------------------------------

interface RegistryCache {
  plugins: PluginInfo[];
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// Marketplace class
// ---------------------------------------------------------------------------

export class PluginMarketplace {
  private readonly registryUrl: string;
  private readonly pluginsDir: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private cache: RegistryCache | null = null;

  static readonly DEFAULT_REGISTRY_URL =
    'https://raw.githubusercontent.com/aide-dev/plugin-registry/main/registry.json';

  constructor(options: MarketplaceOptions = {}) {
    const home = process.env['HOME'] || process.env['USERPROFILE'] || '';
    this.registryUrl =
      options.registryUrl ?? PluginMarketplace.DEFAULT_REGISTRY_URL;
    this.pluginsDir =
      options.pluginsDir ?? path.join(home, '.aide', 'plugins');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Search the registry for plugins matching the query.
   * Matches against id, name, description, tags, and category.
   */
  async search(query: string, category?: PluginCategory): Promise<PluginInfo[]> {
    const all = await this.fetchRegistry();
    const q = query.toLowerCase().trim();

    return all.filter((p) => {
      const matchesCategory = !category || p.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;

      return (
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.author.toLowerCase().includes(q)
      );
    });
  }

  /**
   * Install a plugin by ID. Downloads and extracts to pluginsDir/<pluginId>/.
   * Throws if the plugin is not found or download fails.
   */
  async install(pluginId: string): Promise<InstallResult> {
    const all = await this.fetchRegistry();
    const info = all.find((p) => p.id === pluginId);
    if (!info) {
      throw new Error(`Plugin "${pluginId}" not found in registry`);
    }

    const targetDir = path.join(this.pluginsDir, pluginId);

    // Remove existing installation
    if (fs.existsSync(targetDir)) {
      await rm(targetDir, { recursive: true, force: true });
    }

    await mkdir(targetDir, { recursive: true });

    // Download the plugin archive
    const archivePath = path.join(targetDir, '_archive.tgz');
    await this.downloadFile(info.downloadUrl, archivePath);

    // Extract the archive
    await this.extractArchive(archivePath, targetDir);

    // Clean up archive
    try {
      await rm(archivePath, { force: true });
    } catch {
      // non-fatal
    }

    // Write install metadata
    const meta = {
      pluginId,
      version: info.version,
      installedAt: new Date().toISOString(),
      registryEntry: info,
    };
    await writeFile(
      path.join(targetDir, '.aide-install.json'),
      JSON.stringify(meta, null, 2),
      'utf-8',
    );

    return {
      pluginId,
      version: info.version,
      installedAt: meta.installedAt,
    };
  }

  /**
   * Uninstall a plugin by removing its directory.
   */
  async uninstall(pluginId: string): Promise<void> {
    const targetDir = path.join(this.pluginsDir, pluginId);

    if (!fs.existsSync(targetDir)) {
      throw new Error(`Plugin "${pluginId}" is not installed`);
    }

    await rm(targetDir, { recursive: true, force: true });
  }

  /**
   * Check for updates for all installed plugins.
   */
  async checkUpdates(): Promise<UpdateInfo[]> {
    const installed = await this.listInstalled();
    if (installed.length === 0) return [];

    let registry: PluginInfo[];
    try {
      registry = await this.fetchRegistry();
    } catch {
      // Network unavailable — return no-update info
      return installed.map((p) => ({
        pluginId: p.id,
        currentVersion: p.version,
        latestVersion: p.version,
        hasUpdate: false,
      }));
    }

    const registryMap = new Map(registry.map((p) => [p.id, p]));

    return installed.map((p) => {
      const latest = registryMap.get(p.id);
      const latestVersion = latest?.version ?? p.version;
      return {
        pluginId: p.id,
        currentVersion: p.version,
        latestVersion,
        hasUpdate: latest ? compareVersions(latestVersion, p.version) > 0 : false,
      };
    });
  }

  /**
   * Update a plugin to the latest version.
   */
  async update(pluginId: string): Promise<InstallResult> {
    return this.install(pluginId);
  }

  /**
   * List all installed plugins (reads .aide-install.json from each subdirectory).
   */
  async listInstalled(): Promise<Array<{ id: string; version: string; installedAt: string }>> {
    if (!fs.existsSync(this.pluginsDir)) return [];

    const results: Array<{ id: string; version: string; installedAt: string }> = [];

    let entries: fs.Dirent[];
    try {
      entries = await readdir(this.pluginsDir, { withFileTypes: true });
    } catch {
      return [];
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metaPath = path.join(this.pluginsDir, entry.name, '.aide-install.json');
      try {
        const raw = await readFile(metaPath, 'utf-8');
        const meta = JSON.parse(raw);
        results.push({
          id: meta.pluginId ?? entry.name,
          version: meta.version ?? '0.0.0',
          installedAt: meta.installedAt ?? '',
        });
      } catch {
        // Directory exists but no metadata — include with unknown version
        results.push({ id: entry.name, version: '0.0.0', installedAt: '' });
      }
    }

    return results;
  }

  /**
   * Get detailed info for a single plugin from the registry.
   */
  async getInfo(pluginId: string): Promise<PluginInfo | null> {
    try {
      const all = await this.fetchRegistry();
      return all.find((p) => p.id === pluginId) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Invalidate the local registry cache, forcing a fresh fetch on next call.
   */
  invalidateCache(): void {
    this.cache = null;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async fetchRegistry(): Promise<PluginInfo[]> {
    // Return cached data if still fresh
    if (this.cache && Date.now() - this.cache.fetchedAt < this.cacheTtlMs) {
      return this.cache.plugins;
    }

    let plugins: PluginInfo[];
    try {
      plugins = await this.fetchJson<PluginInfo[]>(this.registryUrl);
      if (!Array.isArray(plugins)) {
        throw new Error('Registry response is not an array');
      }
    } catch (err) {
      // If we have stale cache, return it rather than failing
      if (this.cache) {
        return this.cache.plugins;
      }
      throw new Error(
        `Failed to fetch plugin registry from ${this.registryUrl}: ${(err as Error).message}`,
      );
    }

    this.cache = { plugins, fetchedAt: Date.now() };
    return plugins;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'aide-marketplace/0.1' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs * 4); // longer for downloads

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'aide-marketplace/0.1' },
      });

      if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      const dest = createWriteStream(destPath);
      await pipeline(Readable.fromWeb(response.body as import('stream/web').ReadableStream), dest);
    } finally {
      clearTimeout(timer);
    }
  }

  private async extractArchive(archivePath: string, destDir: string): Promise<void> {
    // Use Node's built-in zlib + tar parsing for .tgz files
    // For .zip files, fall back to a simple unzip approach
    const ext = archivePath.toLowerCase();

    if (ext.endsWith('.tgz') || ext.endsWith('.tar.gz')) {
      await this.extractTarGz(archivePath, destDir);
    } else if (ext.endsWith('.zip')) {
      await this.extractZip(archivePath, destDir);
    } else {
      // Unknown format — try tar.gz first
      try {
        await this.extractTarGz(archivePath, destDir);
      } catch {
        throw new Error(`Unsupported archive format: ${path.basename(archivePath)}`);
      }
    }
  }

  private async extractTarGz(archivePath: string, destDir: string): Promise<void> {
    const { createGunzip } = await import('node:zlib');
    const { createReadStream } = await import('node:fs');

    // Minimal tar parser — handles ustar format
    const gunzip = createGunzip();
    const source = createReadStream(archivePath);

    await new Promise<void>((resolve, reject) => {
      const chunks: Buffer[] = [];

      gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
      gunzip.on('end', async () => {
        try {
          const buf = Buffer.concat(chunks);
          await parseTar(buf, destDir);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      gunzip.on('error', reject);
      source.on('error', reject);
      source.pipe(gunzip);
    });
  }

  private async extractZip(_archivePath: string, _destDir: string): Promise<void> {
    // ZIP extraction requires a third-party library (e.g. unzipper).
    // For MVP, we note this limitation and throw a helpful error.
    throw new Error(
      'ZIP extraction is not supported in the built-in marketplace. ' +
        'Please use a .tgz archive or install the aide-zip-support plugin.',
    );
  }
}

// ---------------------------------------------------------------------------
// Minimal tar parser (ustar / POSIX.1-1988)
// ---------------------------------------------------------------------------

async function parseTar(buf: Buffer, destDir: string): Promise<void> {
  const BLOCK = 512;
  let offset = 0;

  while (offset + BLOCK <= buf.length) {
    const header = buf.slice(offset, offset + BLOCK);

    // Check for end-of-archive (two zero blocks)
    if (header.every((b) => b === 0)) break;

    const name = readTarString(header, 0, 100);
    const sizeStr = readTarString(header, 124, 12);
    const typeFlag = String.fromCharCode(header[156]);

    const size = parseInt(sizeStr.trim(), 8) || 0;
    offset += BLOCK;

    if (!name || typeFlag === '5') {
      // Directory entry
      if (name) {
        const dirPath = path.join(destDir, sanitizeTarPath(name));
        await mkdir(dirPath, { recursive: true });
      }
    } else if (typeFlag === '0' || typeFlag === '' || typeFlag === '\0') {
      // Regular file
      const filePath = path.join(destDir, sanitizeTarPath(name));
      const fileDir = path.dirname(filePath);
      await mkdir(fileDir, { recursive: true });

      const content = buf.slice(offset, offset + size);
      await writeFile(filePath, content);
    }

    // Advance past file data (rounded up to block boundary)
    offset += Math.ceil(size / BLOCK) * BLOCK;
  }
}

function readTarString(buf: Buffer, offset: number, length: number): string {
  const slice = buf.slice(offset, offset + length);
  const nullIdx = slice.indexOf(0);
  return slice.slice(0, nullIdx >= 0 ? nullIdx : length).toString('utf-8');
}

/** Prevent path traversal attacks in tar archives */
function sanitizeTarPath(tarPath: string): string {
  // Remove leading slashes and any .. components
  return tarPath
    .replace(/^\/+/, '')
    .split('/')
    .filter((part) => part !== '..' && part !== '.')
    .join(path.sep);
}

// ---------------------------------------------------------------------------
// Semver comparison (major.minor.patch only)
// ---------------------------------------------------------------------------

function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);

  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return aPat - bPat;
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let _defaultMarketplace: PluginMarketplace | null = null;

export function getMarketplace(options?: MarketplaceOptions): PluginMarketplace {
  if (!_defaultMarketplace || options) {
    _defaultMarketplace = new PluginMarketplace(options);
  }
  return _defaultMarketplace;
}
