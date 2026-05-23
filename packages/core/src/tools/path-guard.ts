/**
 * path-guard.ts — Path traversal protection for file tools
 *
 * All file tools must call validatePath() before reading or writing.
 * Reads are allowed anywhere (the agent needs to read system files sometimes).
 * Writes are restricted to the working directory.
 */

import { resolve, relative, isAbsolute } from 'node:path';

let _workingDirectory: string = process.cwd();

export function setWorkingDirectory(dir: string): void {
  _workingDirectory = resolve(dir);
}

export function getWorkingDirectory(): string {
  return _workingDirectory;
}

/**
 * Validate a file path for write operations.
 * Returns null if allowed, or an error string if denied.
 */
export function validateWritePath(filePath: string): string | null {
  const abs = isAbsolute(filePath) ? filePath : resolve(_workingDirectory, filePath);
  const normalized = resolve(abs);
  const rel = relative(_workingDirectory, normalized);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return `Write denied: "${normalized}" is outside the working directory "${_workingDirectory}". Only files within the working directory may be written.`;
  }
  return null;
}

/**
 * Resolve a path relative to the working directory.
 */
export function resolvePath(filePath: string): string {
  if (isAbsolute(filePath)) return resolve(filePath);
  return resolve(_workingDirectory, filePath);
}
