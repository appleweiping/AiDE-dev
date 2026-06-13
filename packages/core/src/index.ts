// Provider
export type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderMessage,
  ProviderToolCall,
  TokenUsage,
  ProviderFactory,
} from './provider/types.js';
export { OpenAICompatProvider } from './provider/openai-compat.js';
export { ProviderRegistry, providerRegistry } from './provider/registry.js';

// Tools
export { ToolRegistry, toolRegistry, registerBuiltinTools, createDefaultTools } from './tools/index.js';
export type { ToolResult, ToolHandler, RegisteredTool } from './tools/registry.js';
export { fileReadTool } from './tools/file-read.js';
export { fileWriteTool } from './tools/file-write.js';
export { fileEditTool } from './tools/file-edit.js';
export { bashTool } from './tools/bash.js';
export { globTool } from './tools/glob.js';
export { grepTool } from './tools/grep.js';

// Agent
export { Agent } from './agent.js';
export type { AgentEvents } from './agent.js';

// Hooks
export { HooksManager, globalHooksManager } from './hooks/manager.js';
export type { HookEvent, HookDefinition, HookContext } from './hooks/manager.js';

// Context Loader
export { loadProjectContext, formatContextForPrompt } from './context-loader.js';
export type { LoadedContext, ContextFile } from './context-loader.js';

// Safety
export { ApprovalManager, classifyCommand } from './safety/approval.js';
export type { RiskLevel, RiskAssessment } from './safety/approval.js';
export { FileSandbox } from './safety/sandbox.js';

// Session
export { SessionManager } from './session/manager.js';

// IPC Server
export { IpcServer, startIpcServer } from './ipc-server.js';

// Git
export { GitOperations, WorktreeManager } from './git/operations.js';

// Plan & Task
export { PlanManager } from './plan/manager.js';
export type { Plan, PlanStep, PlanPhase } from './plan/manager.js';
export { TaskManager } from './task/manager.js';
export type { TaskItem } from './task/manager.js';

// Extra Tools
export { webSearchTool } from './tools/web-search.js';
export { webFetchTool } from './tools/web-fetch.js';
export { notebookEditTool } from './tools/notebook-edit.js';
export { monitorTool, stopMonitor, listMonitors } from './tools/monitor.js';
export { powershellTool } from './tools/powershell.js';
export { nodeReplTool } from './tools/node-repl.js';
export { cronTool, checkAndFireJobs } from './tools/cron.js';
export { askUserTool, respondToQuestion, askUserEvents } from './tools/ask-user.js';
export { handleTodoCommand, todoAdd, todoList, todoDone, todoStart, todoRemove, todoClear, formatTodoList, setTodoStorePath } from './tools/todo.js';
export type { TodoItem, TodoStatus, TodoPriority } from './tools/todo.js';

// MCP
export { McpClient } from './mcp/client.js';
export type { McpServerConfig, McpTool } from './mcp/client.js';
export { McpManager } from './mcp/manager.js';
export type { McpServerStatus } from './mcp/manager.js';

// Notifications
export { NotificationManager } from './notification/manager.js';
export type { Notification } from './notification/manager.js';

// Context Compaction
export { compactContext, estimateTokenCount, estimateMessageTokens } from './session/compaction.js';

// Sub-Agent
export { SubAgentManager, SharedContext } from './agent/sub-agent.js';
export type {
  SubAgentConfig,
  SubAgentResult,
  SubAgentManagerEvents,
} from './agent/sub-agent.js';

// Auto-Updater
export { AutoUpdater } from './updater/index.js';
export type {
  UpdaterOptions,
  UpdateInfo,
  ReleaseAsset,
  DownloadProgress,
  AutoUpdaterEvents,
} from './updater/index.js';

// SQLite Session Store
export { SqliteSessionStore } from './session/sqlite-store.js';
export type { SessionIndexEntry as SqliteSessionIndexEntry } from './session/sqlite-store.js';

// RAG / Local Indexing
export { ProjectIndexer, indexProject, searchIndex } from './rag/indexer.js';
export type { IndexOptions, IndexStats, SearchResult } from './rag/indexer.js';
export { chunkFile, detectLanguage } from './rag/chunker.js';
export type { Chunk, ChunkOptions } from './rag/chunker.js';
export {
  createIndex as createTfIdfIndex,
  addDocument as addTfIdfDocument,
  removeDocument as removeTfIdfDocument,
  search as tfidfSearch,
  tokenise,
  serializeIndex,
  deserializeIndex,
} from './rag/tfidf.js';
export type {
  TfIdfDocument,
  TfIdfIndex,
  SearchHit,
  SerializedIndex,
} from './rag/tfidf.js';

// Plugin Marketplace
export { PluginMarketplace, getMarketplace } from './plugin/marketplace.js';
export type {
  PluginInfo,
  PluginCategory,
  MarketplaceOptions,
  InstallResult,
  UpdateInfo as PluginUpdateInfo,
} from './plugin/marketplace.js';

// Plugin Manager
export { PluginManager } from './plugin/manager.js';
export type {
  PluginManifest,
  PluginContext,
  LoadedPlugin,
} from './plugin/manager.js';

// Slash Commands
export { SlashCommandRegistry, globalSlashRegistry } from './slash-commands/registry.js';
export type {
  SlashCommandDefinition,
  SlashCommandContext,
  SlashCommandResult,
  SlashCommandHandler,
  SlashCommandRegistryEvents,
} from './slash-commands/registry.js';
export { builtinCommands } from './slash-commands/builtins.js';

// Docker Sandbox
export { DockerSandbox, createSandboxedBashTool } from './safety/docker-sandbox.js';
export type { SandboxOptions, SandboxResult } from './safety/docker-sandbox.js';

// LSP Tools
export { LspClient, createLspHoverTool, createLspDefinitionTool, createLspReferencesTool, LSP_PRESETS } from './tools/lsp.js';

// Browser Automation
export {
  BrowserSession,
  createBrowserNavigateTool,
  createBrowserGetContentTool,
  createBrowserClickTool,
  createBrowserFillTool,
  createBrowserScreenshotTool,
  createBrowserEvaluateTool,
  browserToolNames,
} from './tools/browser.js';

// Desktop Control
export {
  createScreenshotTool,
  createMouseClickTool,
  createKeyboardTypeTool,
  createKeyPressTool,
  createScrollTool,
  desktopToolNames,
} from './tools/desktop-control.js';

// Voice / TTS
export { VoiceManager, createTtsTool } from './tools/voice.js';
export type { TtsOptions, TtsProvider } from './tools/voice.js';

// Skills Library
export { SkillsManager, createSkillTool, createSkillListTool } from './tools/skills.js';
export type { Skill, SkillArg } from './tools/skills.js';

// Telemetry (OpenTelemetry)
export { Telemetry, globalTelemetry } from './telemetry/index.js';
export type { TelemetryOptions, TelemetrySpan, AgentMetrics } from './telemetry/index.js';

// A2A Protocol Server
export { A2AServer } from './a2a/server.js';
export type { A2AServerOptions, AgentCard, A2ATask } from './a2a/server.js';

// Background Daemon
export { AideDaemon, startDaemon, isDaemonRunning, getDaemonPid, stopDaemon } from './daemon.js';
export type { DaemonOptions } from './daemon.js';



