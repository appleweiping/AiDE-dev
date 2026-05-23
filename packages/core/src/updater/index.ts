/**
 * updater/index.ts
 *
 * Auto-updater for AiDE.
 *
 * Checks GitHub Releases API for a newer version, downloads the
 * platform-appropriate asset, and emits progress events.
 *
 * Events:
 *   'update-available'   — { current, latest, releaseNotes }
 *   'download-progress'  — { percent, bytesDownloaded, totalBytes }
 *   'update-ready'       — { version, filePath }
 *   'error'              — Error
 *   'no-update'          — { current, latest }
 *
 * Usage:
 *   const updater = new AutoUpdater({ owner: 'your-org', repo: 'aide' });
 *   const info = await updater.checkForUpdates();
 *   if (info) {
 *     const path = await updater.downloadUpdate(info.latestVersion);
 *   }
 */

import { EventEmitter } from 'node:events';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import * as https from 'node:https';
import * as http from 'node:http';
import { URL } from 'node:url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpdaterOptions {
  /** GitHub repository owner. */
  owner: string;
  /** GitHub repository name. */
  repo: string;
  /** Current application version (semver, e.g. "0.1.0"). */
  currentVersion?: string;
  /** Directory to download update packages into. Defaults to OS temp dir. */
  downloadDir?: string;
  /** GitHub API base URL. Override for GitHub Enterprise. */
  apiBaseUrl?: string;
  /** Request timeout in milliseconds. Default 30 000. */
  timeoutMs?: number;
}

export interface UpdateInfo {
  /** Current installed version. */
  currentVersion: string;
  /** Latest available version from GitHub. */
  latestVersion: string;
  /** GitHub release tag name (e.g. "v0.2.0"). */
  tagName: string;
  /** Release notes (markdown). */
  releaseNotes: string;
  /** URL of the release page. */
  releaseUrl: string;
  /** Platform-specific download asset, if found. */
  asset: ReleaseAsset | null;
  /** Publication date of the release. */
  publishedAt: string;
}

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
  contentType: string;
}

export interface DownloadProgress {
  percent: number;
  bytesDownloaded: number;
  totalBytes: number;
}

// ---------------------------------------------------------------------------
// Event map
// ---------------------------------------------------------------------------

export interface AutoUpdaterEvents {
  'update-available': [info: UpdateInfo];
  'download-progress': [progress: DownloadProgress];
  'update-ready': [payload: { version: string; filePath: string }];
  'no-update': [payload: { current: string; latest: string }];
  error: [err: Error];
}

export interface AutoUpdater {
  on<K extends keyof AutoUpdaterEvents>(
    event: K,
    listener: (...args: AutoUpdaterEvents[K]) => void,
  ): this;
  emit<K extends keyof AutoUpdaterEvents>(
    event: K,
    ...args: AutoUpdaterEvents[K]
  ): boolean;
}

// ---------------------------------------------------------------------------
// AutoUpdater
// ---------------------------------------------------------------------------

export class AutoUpdater extends EventEmitter {
  private readonly owner: string;
  private readonly repo: string;
  private readonly currentVersion: string;
  private readonly downloadDir: string;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;

  /** Track in-progress downloads so we can cancel them. */
  private activeDownload: { abort: () => void } | null = null;

  constructor(options: UpdaterOptions) {
    super();
    this.owner = options.owner;
    this.repo = options.repo;
    this.currentVersion = options.currentVersion ?? this.readPackageVersion();
    this.downloadDir = options.downloadDir ?? join(tmpdir(), 'aide-updates');
    this.apiBaseUrl = options.apiBaseUrl ?? 'https://api.github.com';
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Check GitHub for a newer release.
   * Returns UpdateInfo if a newer version is available, null otherwise.
   * Also emits 'update-available' or 'no-update'.
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      const release = await this.fetchLatestRelease();
      const latestVersion = this.normalizeVersion(release.tag_name);
      const current = this.normalizeVersion(this.currentVersion);

      if (!this.isNewer(latestVersion, current)) {
        this.emit('no-update', { current, latest: latestVersion });
        return null;
      }

      const asset = this.selectAsset(release.assets);

      const info: UpdateInfo = {
        currentVersion: current,
        latestVersion,
        tagName: release.tag_name,
        releaseNotes: release.body ?? '',
        releaseUrl: release.html_url,
        asset,
        publishedAt: release.published_at,
      };

      this.emit('update-available', info);
      return info;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Download the update package for `version`.
   * Emits 'download-progress' during download and 'update-ready' on completion.
   * Returns the local file path of the downloaded package.
   *
   * @param version  Semver string (e.g. "0.2.0") or tag name (e.g. "v0.2.0").
   * @param assetUrl Optional direct download URL. If omitted, fetches the
   *                 release for `version` and selects the platform asset.
   */
  async downloadUpdate(version: string, assetUrl?: string): Promise<string> {
    try {
      await mkdir(this.downloadDir, { recursive: true });

      let url = assetUrl;
      let fileName: string;

      if (!url) {
        const tag = version.startsWith('v') ? version : `v${version}`;
        const release = await this.fetchRelease(tag);
        const asset = this.selectAsset(release.assets);
        if (!asset) {
          throw new Error(
            `No suitable asset found for platform ${process.platform}/${process.arch} in release ${tag}`,
          );
        }
        url = asset.downloadUrl;
        fileName = asset.name;
      } else {
        fileName = basename(new URL(url).pathname) || `aide-update-${version}`;
      }

      const destPath = join(this.downloadDir, fileName);

      // Remove stale partial download if present
      if (existsSync(destPath)) {
        await unlink(destPath);
      }

      await this.downloadFile(url, destPath);

      const normalizedVersion = this.normalizeVersion(version);
      this.emit('update-ready', { version: normalizedVersion, filePath: destPath });
      return destPath;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
      throw error;
    }
  }

  /** Cancel any in-progress download. */
  cancelDownload(): void {
    this.activeDownload?.abort();
    this.activeDownload = null;
  }

  // -------------------------------------------------------------------------
  // GitHub API helpers
  // -------------------------------------------------------------------------

  private async fetchLatestRelease(): Promise<GitHubRelease> {
    const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/releases/latest`;
    return this.fetchJson<GitHubRelease>(url);
  }

  private async fetchRelease(tag: string): Promise<GitHubRelease> {
    const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/releases/tags/${encodeURIComponent(tag)}`;
    return this.fetchJson<GitHubRelease>(url);
  }

  private fetchJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': `aide-updater/${this.currentVersion}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        timeout: this.timeoutMs,
      };

      const req = https.request(options, (res) => {
        // Follow redirects (GitHub sometimes redirects)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.fetchJson<T>(res.headers.location).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned HTTP ${res.statusCode} for ${url}`));
          return;
        }

        let body = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk: string) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body) as T);
          } catch {
            reject(new Error('Failed to parse GitHub API response'));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after ${this.timeoutMs}ms`));
      });

      req.on('error', reject);
      req.end();
    });
  }

  // -------------------------------------------------------------------------
  // Download helpers
  // -------------------------------------------------------------------------

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': `aide-updater/${this.currentVersion}`,
        },
        timeout: this.timeoutMs,
      };

      const doRequest = (requestUrl: string): void => {
        const parsedUrl = new URL(requestUrl);
        const reqOptions = {
          ...options,
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
        };

        const req = (parsedUrl.protocol === 'https:' ? https : http).request(
          reqOptions,
          (res) => {
            // Follow redirects (GitHub asset downloads redirect to S3)
            if (
              res.statusCode &&
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              doRequest(res.headers.location);
              return;
            }

            if (res.statusCode !== 200) {
              reject(new Error(`Download failed: HTTP ${res.statusCode}`));
              return;
            }

            const totalBytes = parseInt(res.headers['content-length'] ?? '0', 10);
            let bytesDownloaded = 0;

            res.on('data', (chunk: Buffer) => {
              bytesDownloaded += chunk.length;
              if (totalBytes > 0) {
                const percent = Math.round((bytesDownloaded / totalBytes) * 100);
                this.emit('download-progress', { percent, bytesDownloaded, totalBytes });
              }
            });

            const writeStream = createWriteStream(destPath);
            pipeline(res, writeStream).then(resolve).catch(reject);
          },
        );

        req.on('timeout', () => {
          req.destroy();
          reject(new Error(`Download timed out after ${this.timeoutMs}ms`));
        });

        req.on('error', reject);

        this.activeDownload = { abort: () => req.destroy() };
        req.end();
      };

      doRequest(url);
    });
  }

  // -------------------------------------------------------------------------
  // Asset selection
  // -------------------------------------------------------------------------

  /**
   * Select the best asset for the current platform and architecture.
   * Matching priority:
   *   1. Exact platform+arch match (e.g. "aide-0.2.0-win32-x64.exe")
   *   2. Platform-only match (e.g. "aide-0.2.0-darwin.dmg")
   *   3. First asset (fallback)
   */
  private selectAsset(assets: GitHubAsset[]): ReleaseAsset | null {
    if (!assets || assets.length === 0) return null;

    const platform = this.platformSuffix();
    const arch = this.archSuffix();

    // Try exact platform+arch match
    let match = assets.find((a) => {
      const name = a.name.toLowerCase();
      return name.includes(platform) && name.includes(arch);
    });

    // Fall back to platform-only match
    if (!match) {
      match = assets.find((a) => a.name.toLowerCase().includes(platform));
    }

    // Fall back to first asset
    if (!match) {
      match = assets[0];
    }

    return {
      name: match.name,
      downloadUrl: match.browser_download_url,
      size: match.size,
      contentType: match.content_type,
    };
  }

  private platformSuffix(): string {
    switch (process.platform) {
      case 'win32':   return 'win';
      case 'darwin':  return 'mac';
      case 'linux':   return 'linux';
      default:        return process.platform;
    }
  }

  private archSuffix(): string {
    switch (process.arch) {
      case 'x64':   return 'x64';
      case 'arm64': return 'arm64';
      case 'ia32':  return 'x86';
      default:      return process.arch;
    }
  }

  // -------------------------------------------------------------------------
  // Version helpers
  // -------------------------------------------------------------------------

  /** Strip leading "v" from a version string. */
  private normalizeVersion(version: string): string {
    return version.replace(/^v/, '');
  }

  /**
   * Returns true if `candidate` is strictly newer than `current`.
   * Uses simple numeric semver comparison (major.minor.patch).
   */
  private isNewer(candidate: string, current: string): boolean {
    const parse = (v: string): [number, number, number] => {
      const parts = v.split('.').map((p) => parseInt(p, 10) || 0);
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
    };

    const [cMaj, cMin, cPat] = parse(candidate);
    const [eMaj, eMin, ePat] = parse(current);

    if (cMaj !== eMaj) return cMaj > eMaj;
    if (cMin !== eMin) return cMin > eMin;
    return cPat > ePat;
  }

  private readPackageVersion(): string {
    try {
      // Walk up from this file to find the nearest package.json
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../../package.json') as { version?: string };
      return pkg.version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
}

// ---------------------------------------------------------------------------
// Internal GitHub API types
// ---------------------------------------------------------------------------

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string | null;
  html_url: string;
  published_at: string;
  assets: GitHubAsset[];
  prerelease: boolean;
  draft: boolean;
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
  state: string;
}
