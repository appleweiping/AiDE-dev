export { ToolRegistry, toolRegistry } from './registry.js';
export type { ToolResult, ToolHandler, RegisteredTool } from './registry.js';
export { fileReadTool } from './file-read.js';
export { fileWriteTool } from './file-write.js';
export { fileEditTool } from './file-edit.js';
export { bashTool } from './bash.js';
export { globTool } from './glob.js';
export { grepTool } from './grep.js';
export { webSearchTool } from './web-search.js';
export { webFetchTool } from './web-fetch.js';
export { notebookEditTool } from './notebook-edit.js';
export { monitorTool } from './monitor.js';
export { powershellTool } from './powershell.js';
export { nodeReplTool } from './node-repl.js';
export { cronTool } from './cron.js';
export { askUserTool } from './ask-user.js';

import { ToolRegistry, toolRegistry } from './registry.js';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { fileEditTool } from './file-edit.js';
import { bashTool } from './bash.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { webSearchTool } from './web-search.js';
import { webFetchTool } from './web-fetch.js';
import { notebookEditTool } from './notebook-edit.js';
import { monitorTool } from './monitor.js';
import { powershellTool } from './powershell.js';
import { nodeReplTool } from './node-repl.js';
import { cronTool } from './cron.js';
import { askUserTool } from './ask-user.js';

export function registerBuiltinTools(): void {
  toolRegistry.registerTool(fileReadTool);
  toolRegistry.registerTool(fileWriteTool);
  toolRegistry.registerTool(fileEditTool);
  toolRegistry.registerTool(bashTool);
  toolRegistry.registerTool(globTool);
  toolRegistry.registerTool(grepTool);
  toolRegistry.registerTool(webSearchTool);
  toolRegistry.registerTool(webFetchTool);
  toolRegistry.registerTool(notebookEditTool);
  toolRegistry.registerTool(monitorTool);
  if (process.platform === 'win32') {
    toolRegistry.registerTool(powershellTool);
  }
  toolRegistry.registerTool(nodeReplTool);
  toolRegistry.registerTool(cronTool);
  toolRegistry.registerTool(askUserTool);
}

export function createDefaultTools(workingDirectory: string): ToolRegistry {
  const registry = new ToolRegistry(workingDirectory);
  registry.registerTool(fileReadTool);
  registry.registerTool(fileWriteTool);
  registry.registerTool(fileEditTool);
  registry.registerTool(bashTool);
  registry.registerTool(globTool);
  registry.registerTool(grepTool);
  registry.registerTool(webSearchTool);
  registry.registerTool(webFetchTool);
  registry.registerTool(notebookEditTool);
  registry.registerTool(monitorTool);
  if (process.platform === 'win32') {
    registry.registerTool(powershellTool);
  }
  registry.registerTool(nodeReplTool);
  registry.registerTool(cronTool);
  registry.registerTool(askUserTool);
  return registry;
}
