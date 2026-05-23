/**
 * AiDE VS Code Extension — Chat Panel WebviewPanel
 *
 * Renders the chat UI inside a VS Code webview and communicates with the
 * extension host via postMessage / onDidReceiveMessage.
 */

import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Message protocol between webview and extension host
// ---------------------------------------------------------------------------

export type WebviewToHostMessage =
  | { type: 'sendMessage'; text: string }
  | { type: 'clearHistory' }
  | { type: 'ready' }
  | { type: 'selectProvider' }
  | { type: 'indexProject' };

export type HostToWebviewMessage =
  | { type: 'assistantChunk'; text: string; messageId: string }
  | { type: 'assistantDone'; messageId: string }
  | { type: 'assistantError'; error: string; messageId: string }
  | { type: 'userMessage'; text: string; messageId: string }
  | { type: 'providerChanged'; provider: string; model: string }
  | { type: 'indexingStarted' }
  | { type: 'indexingDone'; stats: { filesIndexed: number; chunksTotal: number; durationMs: number } }
  | { type: 'historyCleared' }
  | { type: 'toolActivity'; name: string; status: 'running' | 'done' | 'error'; output?: string };

// ---------------------------------------------------------------------------
// ChatPanel
// ---------------------------------------------------------------------------

export class ChatPanel {
  public static readonly viewType = 'aide.chatView';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private _onDidReceiveMessage = new vscode.EventEmitter<WebviewToHostMessage>();
  public readonly onDidReceiveMessage = this._onDidReceiveMessage.event;

  private _onDidDispose = new vscode.EventEmitter<void>();
  public readonly onDidDispose = this._onDidDispose.event;

  // -------------------------------------------------------------------------
  // Factory
  // -------------------------------------------------------------------------

  static create(
    extensionUri: vscode.Uri,
    column: vscode.ViewColumn = vscode.ViewColumn.Beside,
  ): ChatPanel {
    const panel = vscode.window.createWebviewPanel(
      ChatPanel.viewType,
      'AiDE Chat',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    return new ChatPanel(panel, extensionUri);
  }

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._buildHtml();

    // Forward messages from webview to extension host
    this._panel.webview.onDidReceiveMessage(
      (msg: WebviewToHostMessage) => this._onDidReceiveMessage.fire(msg),
      null,
      this._disposables,
    );

    this._panel.onDidDispose(
      () => {
        this._onDidDispose.fire();
        this.dispose();
      },
      null,
      this._disposables,
    );
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Send a message to the webview. */
  postMessage(message: HostToWebviewMessage): Thenable<boolean> {
    return this._panel.webview.postMessage(message);
  }

  reveal(column?: vscode.ViewColumn): void {
    this._panel.reveal(column);
  }

  get visible(): boolean {
    return this._panel.visible;
  }

  dispose(): void {
    this._panel.dispose();
    this._onDidReceiveMessage.dispose();
    this._onDidDispose.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables = [];
  }

  // -------------------------------------------------------------------------
  // HTML generation
  // -------------------------------------------------------------------------

  private _buildHtml(): string {
    const nonce = getNonce();
    const csp = [
      `default-src 'none'`,
      `style-src 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src data: https:`,
      `font-src 'self'`,
    ].join('; ');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AiDE Chat</title>
  <style>
    /* ---- Reset & base ---- */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --border: var(--vscode-panel-border, #3c3c3c);
      --input-bg: var(--vscode-input-background, #3c3c3c);
      --input-fg: var(--vscode-input-foreground, #cccccc);
      --btn-bg: var(--vscode-button-background, #0e639c);
      --btn-fg: var(--vscode-button-foreground, #ffffff);
      --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
      --user-bubble: var(--vscode-badge-background, #4d4d4d);
      --assistant-bubble: var(--vscode-editor-inactiveSelectionBackground, #2a2d2e);
      --code-bg: var(--vscode-textCodeBlock-background, #1e1e1e);
      --scrollbar: var(--vscode-scrollbarSlider-background, #424242);
      --font-mono: var(--vscode-editor-font-family, 'Cascadia Code', 'Fira Code', monospace);
      --font-ui: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      --font-size: var(--vscode-font-size, 13px);
      --radius: 6px;
    }

    html, body {
      height: 100%;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-ui);
      font-size: var(--font-size);
      overflow: hidden;
    }

    /* ---- Layout ---- */
    #app {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* ---- Header ---- */
    #header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    #header-title {
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    #provider-badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--user-bubble);
      color: var(--fg);
      cursor: pointer;
      user-select: none;
    }

    #provider-badge:hover { opacity: 0.8; }

    #header-actions {
      display: flex;
      gap: 4px;
    }

    .icon-btn {
      background: none;
      border: none;
      color: var(--fg);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: var(--radius);
      font-size: 14px;
      opacity: 0.7;
      transition: opacity 0.15s, background 0.15s;
    }

    .icon-btn:hover { opacity: 1; background: var(--user-bubble); }

    /* ---- Messages ---- */
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }

    #messages::-webkit-scrollbar { width: 6px; }
    #messages::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 3px; }

    .message {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 100%;
      animation: fadeIn 0.15s ease;
    }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

    .message-role {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.6;
    }

    .message-content {
      padding: 8px 10px;
      border-radius: var(--radius);
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message.user .message-content {
      background: var(--user-bubble);
      align-self: flex-end;
      max-width: 85%;
    }

    .message.assistant .message-content {
      background: var(--assistant-bubble);
    }

    .message.assistant .message-role { color: #4ec9b0; }
    .message.user .message-role { color: #9cdcfe; align-self: flex-end; }

    /* Code blocks inside messages */
    .message-content code {
      font-family: var(--font-mono);
      font-size: 12px;
      background: var(--code-bg);
      padding: 1px 4px;
      border-radius: 3px;
    }

    .message-content pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px;
      overflow-x: auto;
      margin: 6px 0;
    }

    .message-content pre code {
      background: none;
      padding: 0;
    }

    /* Tool activity */
    .tool-activity {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: var(--radius);
      background: var(--code-bg);
      border-left: 2px solid #569cd6;
      color: var(--fg);
      opacity: 0.8;
      font-family: var(--font-mono);
    }

    .tool-activity.error { border-left-color: #f44747; }
    .tool-activity.done { border-left-color: #4ec9b0; }

    /* Streaming cursor */
    .streaming-cursor::after {
      content: '▋';
      animation: blink 0.8s step-end infinite;
    }

    @keyframes blink { 50% { opacity: 0; } }

    /* Empty state */
    #empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      opacity: 0.5;
      text-align: center;
      padding: 24px;
    }

    #empty-state .icon { font-size: 40px; }
    #empty-state .title { font-size: 16px; font-weight: 600; }
    #empty-state .subtitle { font-size: 12px; }

    /* ---- Status bar ---- */
    #status-bar {
      padding: 4px 12px;
      font-size: 11px;
      opacity: 0.6;
      border-top: 1px solid var(--border);
      min-height: 22px;
      flex-shrink: 0;
    }

    /* ---- Input area ---- */
    #input-area {
      padding: 8px 12px 12px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    #input-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    #message-input {
      flex: 1;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 10px;
      font-family: var(--font-ui);
      font-size: var(--font-size);
      resize: none;
      min-height: 38px;
      max-height: 200px;
      overflow-y: auto;
      outline: none;
      transition: border-color 0.15s;
      line-height: 1.4;
    }

    #message-input:focus { border-color: var(--btn-bg); }
    #message-input::placeholder { opacity: 0.5; }

    #send-btn {
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      border-radius: var(--radius);
      padding: 8px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.15s;
      white-space: nowrap;
      height: 38px;
    }

    #send-btn:hover:not(:disabled) { background: var(--btn-hover); }
    #send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    #input-hint {
      font-size: 10px;
      opacity: 0.4;
      margin-top: 4px;
      text-align: right;
    }
  </style>
</head>
<body>
<div id="app">
  <!-- Header -->
  <div id="header">
    <div id="header-title">
      <span>AiDE</span>
      <span id="provider-badge" title="Click to change provider/model">gpt-4o</span>
    </div>
    <div id="header-actions">
      <button class="icon-btn" id="index-btn" title="Index project for RAG">⚡</button>
      <button class="icon-btn" id="clear-btn" title="Clear chat history">🗑</button>
    </div>
  </div>

  <!-- Messages -->
  <div id="messages">
    <div id="empty-state">
      <div class="icon">🤖</div>
      <div class="title">AiDE Chat</div>
      <div class="subtitle">Ask anything about your code, or describe a task to run.</div>
    </div>
  </div>

  <!-- Status bar -->
  <div id="status-bar" id="status"></div>

  <!-- Input -->
  <div id="input-area">
    <div id="input-row">
      <textarea
        id="message-input"
        placeholder="Ask AiDE anything… (Enter to send, Shift+Enter for newline)"
        rows="1"
        aria-label="Chat message input"
      ></textarea>
      <button id="send-btn" aria-label="Send message">Send</button>
    </div>
    <div id="input-hint">Enter ↵ send · Shift+Enter newline</div>
  </div>
</div>

<script nonce="${nonce}">
(function() {
  'use strict';

  const vscode = acquireVsCodeApi();

  // ---- DOM refs ----
  const messagesEl = document.getElementById('messages');
  const emptyState = document.getElementById('empty-state');
  const inputEl = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const providerBadge = document.getElementById('provider-badge');
  const clearBtn = document.getElementById('clear-btn');
  const indexBtn = document.getElementById('index-btn');
  const statusEl = document.getElementById('status-bar');

  // ---- State ----
  let isStreaming = false;
  let currentStreamEl = null;
  let currentStreamId = null;

  // ---- Helpers ----
  function setStatus(text) {
    statusEl.textContent = text;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Very simple markdown-like renderer: code blocks and inline code */
  function renderContent(text) {
    // Fenced code blocks
    let html = escapeHtml(text).replace(
      /\`\`\`([\\w]*)?\\n([\\s\\S]*?)\`\`\`/g,
      (_, lang, code) => \`<pre><code class="language-\${lang || ''}">\${code}</code></pre>\`
    );
    // Inline code
    html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    return html;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideEmptyState() {
    if (emptyState) emptyState.style.display = 'none';
  }

  function addMessage(role, content, id) {
    hideEmptyState();
    const div = document.createElement('div');
    div.className = 'message ' + role;
    div.dataset.id = id || '';

    const roleEl = document.createElement('div');
    roleEl.className = 'message-role';
    roleEl.textContent = role === 'user' ? 'You' : 'AiDE';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.innerHTML = renderContent(content);

    div.appendChild(roleEl);
    div.appendChild(contentEl);
    messagesEl.appendChild(div);
    scrollToBottom();
    return contentEl;
  }

  function addToolActivity(name, status, output) {
    hideEmptyState();
    const div = document.createElement('div');
    div.className = 'tool-activity ' + status;
    div.textContent = (status === 'running' ? '⟳ ' : status === 'done' ? '✓ ' : '✗ ') + name + (output ? ': ' + output.slice(0, 120) : '');
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  // ---- Send message ----
  function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isStreaming) return;

    inputEl.value = '';
    autoResize();

    const msgId = 'msg-' + Date.now();
    addMessage('user', text, msgId);

    vscode.postMessage({ type: 'sendMessage', text });
    setStatus('Thinking…');
    sendBtn.disabled = true;
    isStreaming = true;
  }

  // ---- Auto-resize textarea ----
  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
  }

  // ---- Event listeners ----
  sendBtn.addEventListener('click', sendMessage);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener('input', autoResize);

  providerBadge.addEventListener('click', () => {
    vscode.postMessage({ type: 'selectProvider' });
  });

  clearBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'clearHistory' });
  });

  indexBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'indexProject' });
    setStatus('Indexing project…');
  });

  // ---- Handle messages from extension host ----
  window.addEventListener('message', (event) => {
    const msg = event.data;

    switch (msg.type) {
      case 'userMessage': {
        // Already added optimistically above
        break;
      }

      case 'assistantChunk': {
        if (currentStreamId !== msg.messageId) {
          // New streaming message
          currentStreamId = msg.messageId;
          currentStreamEl = addMessage('assistant', '', msg.messageId);
          currentStreamEl.classList.add('streaming-cursor');
          currentStreamEl.dataset.raw = '';
        }
        currentStreamEl.dataset.raw += msg.text;
        currentStreamEl.innerHTML = renderContent(currentStreamEl.dataset.raw);
        currentStreamEl.classList.add('streaming-cursor');
        scrollToBottom();
        break;
      }

      case 'assistantDone': {
        if (currentStreamEl) {
          currentStreamEl.classList.remove('streaming-cursor');
          currentStreamEl = null;
          currentStreamId = null;
        }
        isStreaming = false;
        sendBtn.disabled = false;
        setStatus('');
        break;
      }

      case 'assistantError': {
        if (currentStreamEl) {
          currentStreamEl.classList.remove('streaming-cursor');
          currentStreamEl = null;
          currentStreamId = null;
        }
        isStreaming = false;
        sendBtn.disabled = false;
        setStatus('Error: ' + msg.error);
        const errEl = addMessage('assistant', 'Error: ' + msg.error, msg.messageId);
        errEl.style.color = '#f44747';
        break;
      }

      case 'providerChanged': {
        providerBadge.textContent = msg.model || msg.provider;
        setStatus('Provider: ' + msg.provider + ' / ' + msg.model);
        break;
      }

      case 'indexingStarted': {
        setStatus('Indexing project…');
        break;
      }

      case 'indexingDone': {
        const s = msg.stats;
        setStatus('Indexed ' + s.filesIndexed + ' files, ' + s.chunksTotal + ' chunks in ' + s.durationMs + 'ms');
        break;
      }

      case 'historyCleared': {
        messagesEl.innerHTML = '';
        messagesEl.appendChild(emptyState);
        emptyState.style.display = '';
        setStatus('History cleared');
        break;
      }

      case 'toolActivity': {
        addToolActivity(msg.name, msg.status, msg.output);
        break;
      }
    }
  });

  // Signal ready
  vscode.postMessage({ type: 'ready' });
})();
</script>
</body>
</html>`;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
