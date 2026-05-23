/**
 * AiDE VS Code Extension — Entry Point
 *
 * Activates the extension, registers commands, creates the chat panel,
 * and wires up the @aide/core engine.
 */

import * as vscode from 'vscode';
import { ChatPanel } from './chat-panel.js';

// Lazy-import @aide/core to avoid loading it until needed
type AideCore = typeof import('@aide/core');

// ---------------------------------------------------------------------------
// Extension state
// ---------------------------------------------------------------------------

let coreModule: AideCore | null = null;
let chatPanel: ChatPanel | null = null;
let statusBarItem: vscode.StatusBarItem;
let indexer: InstanceType<AideCore['ProjectIndexer']> | null = null;

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = 'aide.selectProvider';
  statusBarItem.tooltip = 'AiDE: Click to change provider/model';
  updateStatusBar();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('aide.startChat', () => openChatPanel(context)),
    vscode.commands.registerCommand('aide.runAgent', () => runAgentOnSelection(context)),
    vscode.commands.registerCommand('aide.selectProvider', () => selectProvider()),
    vscode.commands.registerCommand('aide.indexProject', () => indexProject()),
    vscode.commands.registerCommand('aide.clearChat', () => clearChat()),
  );

  // Auto-index on save if configured
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      const cfg = vscode.workspace.getConfiguration('aide');
      if (cfg.get<boolean>('autoIndexOnSave') && indexer) {
        try {
          await indexer.indexProject();
        } catch {
          // silent — background operation
        }
      }
    }),
  );

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('aide')) {
        updateStatusBar();
        // Notify open panel of provider change
        if (chatPanel) {
          const cfg = vscode.workspace.getConfiguration('aide');
          chatPanel.postMessage({
            type: 'providerChanged',
            provider: cfg.get<string>('provider') ?? 'openai',
            model: cfg.get<string>('model') ?? 'gpt-4o',
          });
        }
      }
    }),
  );
}

export function deactivate(): void {
  chatPanel?.dispose();
  statusBarItem?.dispose();
}

// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------

async function openChatPanel(context: vscode.ExtensionContext): Promise<void> {
  if (chatPanel) {
    chatPanel.reveal();
    return;
  }

  chatPanel = ChatPanel.create(context.extensionUri);

  // Handle messages from the webview
  chatPanel.onDidReceiveMessage(async (msg) => {
    switch (msg.type) {
      case 'ready': {
        const cfg = vscode.workspace.getConfiguration('aide');
        chatPanel?.postMessage({
          type: 'providerChanged',
          provider: cfg.get<string>('provider') ?? 'openai',
          model: cfg.get<string>('model') ?? 'gpt-4o',
        });
        break;
      }

      case 'sendMessage': {
        await handleChatMessage(msg.text);
        break;
      }

      case 'clearHistory': {
        chatPanel?.postMessage({ type: 'historyCleared' });
        break;
      }

      case 'selectProvider': {
        await selectProvider();
        break;
      }

      case 'indexProject': {
        await indexProject();
        break;
      }
    }
  });

  chatPanel.onDidDispose(() => {
    chatPanel = null;
  });
}

async function handleChatMessage(userText: string): Promise<void> {
  if (!chatPanel) return;

  const core = await loadCore();
  if (!core) return;

  const cfg = vscode.workspace.getConfiguration('aide');
  const provider = cfg.get<string>('provider') ?? 'openai';
  const model = cfg.get<string>('model') ?? 'gpt-4o';
  const apiKey = cfg.get<string>('apiKey') || process.env['AIDE_API_KEY'] || '';
  const baseUrl = cfg.get<string>('baseUrl') || undefined;
  const maxTokens = cfg.get<number>('maxTokens') ?? 4096;
  const temperature = cfg.get<number>('temperature') ?? 0.2;
  const enableRag = cfg.get<boolean>('enableRag') ?? true;
  const ragTopK = cfg.get<number>('ragTopK') ?? 5;
  const systemPrompt = cfg.get<string>('systemPrompt') ?? '';

  const messageId = `msg-${Date.now()}`;

  // Build RAG context if enabled
  let ragContext = '';
  if (enableRag && indexer) {
    try {
      const results = indexer.search(userText, ragTopK);
      if (results.length > 0) {
        ragContext =
          '\n\n--- Relevant code context ---\n' +
          results
            .map(
              (r) =>
                `// ${r.chunk.filePath}:${r.chunk.startLine}-${r.chunk.endLine}\n${r.chunk.content}`,
            )
            .join('\n\n') +
          '\n--- End context ---\n';
      }
    } catch {
      // RAG failure is non-fatal
    }
  }

  // Build provider config
  const providerBaseUrl = resolveBaseUrl(provider, baseUrl);

  // Build system message
  const systemParts: string[] = [
    'You are AiDE, an AI coding assistant integrated into VS Code.',
    'You help developers understand, write, and improve code.',
    'Be concise and precise. Use markdown code blocks for code.',
  ];
  if (systemPrompt) systemParts.push(systemPrompt);
  if (ragContext) systemParts.push(ragContext);

  const messages: import('@aide/core').ProviderMessage[] = [
    { role: 'system', content: systemParts.join('\n\n') },
    { role: 'user', content: userText },
  ];

  // Stream the response
  try {
    const registry = new core.ProviderRegistry();
    const providerConfig = {
      id: provider,
      name: provider,
      baseUrl: providerBaseUrl ?? 'https://api.openai.com/v1',
      apiKey,
      model,
    };
    const providerImpl = registry.get(providerConfig);

    const stream = providerImpl.stream({ messages, maxTokens, temperature });

    for await (const chunk of stream) {
      if (chunk.type === 'content' && chunk.delta) {
        chatPanel.postMessage({ type: 'assistantChunk', text: chunk.delta, messageId });
      }
    }

    chatPanel.postMessage({ type: 'assistantDone', messageId });
  } catch (err) {
    chatPanel.postMessage({
      type: 'assistantError',
      error: (err as Error).message,
      messageId,
    });
  }
}

async function runAgentOnSelection(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('AiDE: No active editor');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);
  if (!selectedText.trim()) {
    vscode.window.showWarningMessage('AiDE: No text selected');
    return;
  }

  const task = await vscode.window.showInputBox({
    prompt: 'What should AiDE do with the selected code?',
    placeHolder: 'e.g. "Add JSDoc comments", "Refactor to use async/await", "Explain this code"',
  });

  if (!task) return;

  await openChatPanel(context);

  const prompt = `${task}\n\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\``;
  await handleChatMessage(prompt);
}

async function selectProvider(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('aide');
  const currentProvider = cfg.get<string>('provider') ?? 'openai';
  const currentModel = cfg.get<string>('model') ?? 'gpt-4o';

  const PROVIDERS: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-3-5-haiku-20241022',
    ],
    ollama: ['llama3', 'mistral', 'codellama', 'deepseek-coder'],
    openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3-70b-instruct'],
    custom: [],
  };

  const providerPick = await vscode.window.showQuickPick(
    Object.keys(PROVIDERS).map((p) => ({
      label: p,
      description: p === currentProvider ? '(current)' : '',
    })),
    { title: 'AiDE: Select Provider', placeHolder: 'Choose an LLM provider' },
  );

  if (!providerPick) return;

  const selectedProvider = providerPick.label;
  const models = PROVIDERS[selectedProvider] ?? [];

  let selectedModel: string | undefined;
  if (models.length > 0) {
    const modelPick = await vscode.window.showQuickPick(
      [
        ...models.map((m) => ({ label: m, description: m === currentModel ? '(current)' : '' })),
        { label: '$(edit) Enter custom model…', description: '' },
      ],
      { title: `AiDE: Select Model (${selectedProvider})`, placeHolder: 'Choose a model' },
    );

    if (!modelPick) return;

    if (modelPick.label.startsWith('$(edit)')) {
      selectedModel = await vscode.window.showInputBox({
        prompt: 'Enter model name',
        value: currentModel,
      });
    } else {
      selectedModel = modelPick.label;
    }
  } else {
    selectedModel = await vscode.window.showInputBox({
      prompt: 'Enter model name',
      value: currentModel,
    });
  }

  if (!selectedModel) return;

  // Check if API key is needed
  const needsKey = selectedProvider !== 'ollama';
  const currentKey = cfg.get<string>('apiKey') ?? '';
  if (needsKey && !currentKey && !process.env['AIDE_API_KEY']) {
    const key = await vscode.window.showInputBox({
      prompt: `Enter API key for ${selectedProvider}`,
      password: true,
      placeHolder: 'sk-…',
    });
    if (key) {
      await cfg.update('apiKey', key, vscode.ConfigurationTarget.Global);
    }
  }

  await cfg.update('provider', selectedProvider, vscode.ConfigurationTarget.Global);
  await cfg.update('model', selectedModel, vscode.ConfigurationTarget.Global);

  updateStatusBar();
  vscode.window.showInformationMessage(
    `AiDE: Switched to ${selectedProvider} / ${selectedModel}`,
  );
}

async function indexProject(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showWarningMessage('AiDE: No workspace folder open');
    return;
  }

  const core = await loadCore();
  if (!core) return;

  const rootDir = workspaceFolders[0].uri.fsPath;

  chatPanel?.postMessage({ type: 'indexingStarted' });

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'AiDE: Indexing project…',
      cancellable: false,
    },
    async (progress) => {
      try {
        indexer = new core.ProjectIndexer(rootDir);
        const stats = await indexer.indexProject();

        chatPanel?.postMessage({ type: 'indexingDone', stats });
        vscode.window.showInformationMessage(
          `AiDE: Indexed ${stats.filesIndexed} files (${stats.chunksTotal} chunks) in ${stats.durationMs}ms`,
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `AiDE: Indexing failed — ${(err as Error).message}`,
        );
      }
    },
  );
}

async function clearChat(): Promise<void> {
  chatPanel?.postMessage({ type: 'historyCleared' });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadCore(): Promise<AideCore | null> {
  if (coreModule) return coreModule;
  try {
    coreModule = await import('@aide/core');
    return coreModule;
  } catch (err) {
    vscode.window.showErrorMessage(
      `AiDE: Failed to load core engine — ${(err as Error).message}`,
    );
    return null;
  }
}

function updateStatusBar(): void {
  const cfg = vscode.workspace.getConfiguration('aide');
  const provider = cfg.get<string>('provider') ?? 'openai';
  const model = cfg.get<string>('model') ?? 'gpt-4o';
  statusBarItem.text = `$(hubot) ${provider}/${model}`;
}

function resolveBaseUrl(provider: string, customBaseUrl?: string): string | undefined {
  if (customBaseUrl) return customBaseUrl;
  switch (provider) {
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    case 'ollama':
      return 'http://localhost:11434/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    default:
      return undefined; // OpenAI default
  }
}
