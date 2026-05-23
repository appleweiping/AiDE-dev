import { resolve, relative, isAbsolute } from 'node:path';

/**
 * FileSandbox restricts file write operations to a workspace directory.
 *
 * Any tool that writes files should call checkWrite() before proceeding.
 * The sandbox does NOT restrict reads — only writes.
 */
export class FileSandbox {
  private workspaceDir: string;
  private allowedPaths: Set<string> = new Set();

  constructor(workspaceDir: string) {
    this.workspaceDir = resolve(workspaceDir);
  }

  getWorkspaceDir(): string {
    return this.workspaceDir;
  }

  /**
   * Add an additional allowed path outside the workspace.
   * Use sparingly — prefer keeping writes inside the workspace.
   */
  allowPath(path: string): void {
    this.allowedPaths.add(resolve(path));
  }

  /**
   * Check whether a write to the given path is permitted.
   * Returns null if allowed, or an error message string if denied.
   */
  checkWrite(filePath: string): string | null {
    const absPath = isAbsolute(filePath) ? filePath : resolve(filePath);
    const normalized = resolve(absPath);

    // Check workspace containment
    const rel = relative(this.workspaceDir, normalized);
    const isInsideWorkspace = !rel.startsWith('..') && !isAbsolute(rel);
    if (isInsideWorkspace) return null;

    // Check explicitly allowed paths
    for (const allowed of this.allowedPaths) {
      const relToAllowed = relative(allowed, normalized);
      if (!relToAllowed.startsWith('..') && !isAbsolute(relToAllowed)) {
        return null;
      }
    }

    return (
      `Write denied: ${normalized} is outside the workspace directory (${this.workspaceDir}). ` +
      `Only files within the workspace may be written.`
    );
  }

  /**
   * Assert that a write is permitted. Throws if denied.
   */
  assertWrite(filePath: string): void {
    const error = this.checkWrite(filePath);
    if (error) throw new Error(error);
  }

  /**
   * Resolve a path relative to the workspace directory.
   */
  resolve(filePath: string): string {
    if (isAbsolute(filePath)) return filePath;
    return resolve(this.workspaceDir, filePath);
  }

  /**
   * Return the path relative to the workspace, for display purposes.
   */
  relative(filePath: string): string {
    const abs = isAbsolute(filePath) ? filePath : resolve(filePath);
    const rel = relative(this.workspaceDir, abs);
    return rel.startsWith('..') ? abs : rel;
  }
}
