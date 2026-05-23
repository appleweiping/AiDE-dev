import type { ToolDefinition } from '@aide/shared';
import { DEFAULT_TOOL_OUTPUT_LIMIT } from '@aide/shared';

// ---------------------------------------------------------------------------
// Tool handler types
// ---------------------------------------------------------------------------

export interface ToolResult {
  output: string;
  isError: boolean;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

// ---------------------------------------------------------------------------
// Write-restricted tools (blocked in plan/read-only mode)
// ---------------------------------------------------------------------------

const WRITE_TOOLS = new Set(['file_write', 'file_edit', 'bash', 'powershell', 'notebook_edit']);

// ---------------------------------------------------------------------------
// ToolRegistry
// ---------------------------------------------------------------------------

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  private readOnly = false;

  /**
   * Register a tool. Overwrites any existing tool with the same name.
   */
  register(
    name: string,
    description: string,
    parameters: Record<string, unknown>,
    handler: ToolHandler,
  ): void {
    this.tools.set(name, {
      definition: { name, description, parameters },
      handler,
    });
  }

  /**
   * Register a pre-built RegisteredTool object.
   */
  registerTool(tool: RegisteredTool): void {
    this.tools.set(tool.definition.name, tool);
  }

  /**
   * Retrieve a registered tool by name.
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tool names.
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Return tool definitions in the format expected by the LLM API.
   */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /**
   * Execute a tool by name, returning a truncated string result.
   * Never throws — errors are returned as ToolResult with isError=true.
   */
  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { output: `Unknown tool: ${name}`, isError: true };
    }

    // Block write tools when in read-only (plan) mode
    if (this.readOnly && WRITE_TOOLS.has(name)) {
      return {
        output: 'Tool denied: AiDE is in Plan Mode (read-only). Exit plan mode first.',
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args);
      return {
        output: truncate(result.output, DEFAULT_TOOL_OUTPUT_LIMIT),
        isError: result.isError,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: `Tool error: ${message}`, isError: true };
    }
  }

  /** Remove a tool by name. */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /** Enable or disable read-only (plan) mode. */
  setReadOnly(enabled: boolean): void {
    this.readOnly = enabled;
  }

  /** Returns true when the registry is in read-only (plan) mode. */
  isReadOnly(): boolean {
    return this.readOnly;
  }
}

// ---------------------------------------------------------------------------
// Singleton registry used by the built-in tools
// ---------------------------------------------------------------------------

export const toolRegistry = new ToolRegistry();

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const half = Math.floor(limit / 2);
  return (
    text.slice(0, half) +
    `\n\n[... ${text.length - limit} characters truncated ...]\n\n` +
    text.slice(text.length - half)
  );
}
