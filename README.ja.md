<p align="center">
  <img src="assets/banner.png" alt="AiDE Banner" width="800" />
</p>

<h1 align="center">AiDE — AI 開発環境</h1>

<p align="center">
  <strong>中国語LLM対応のデスクトップコーディングエージェント — Claude Code・Codexと同等機能のオープンソース代替</strong>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-green" alt="Platform" />
  <img src="https://img.shields.io/badge/framework-Tauri%20v2-orange" alt="Framework" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node" />
  <img src="https://img.shields.io/badge/version-0.1.0-informational" alt="Version" />
</p>

<p align="center">
  <img src="assets/logos/deepseek.png" height="32" alt="DeepSeek" />
  &nbsp;&nbsp;
  <img src="assets/logos/qwen.png" height="32" alt="Qwen" />
  &nbsp;&nbsp;
  <img src="assets/logos/glm.png" height="32" alt="GLM" />
  &nbsp;&nbsp;
  <img src="assets/logos/kimi.png" height="32" alt="Kimi" />
  &nbsp;&nbsp;
  <img src="assets/logos/doubao.png" height="32" alt="Doubao" />
  &nbsp;&nbsp;
  <img src="assets/logos/minimax.png" height="32" alt="MiniMax" />
</p>

---

## ダウンロード

<p align="center">

| プラットフォーム | インストーラー | ポータブル |
|---|---|---|
| **Windows x64** | [AiDE-0.1.0-x64-setup.exe](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-x64-setup.exe) | [AiDE-0.1.0-x64.zip](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-x64.zip) |
| **Windows arm64** | [AiDE-0.1.0-arm64-setup.exe](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-arm64-setup.exe) | [AiDE-0.1.0-arm64.zip](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-arm64.zip) |
| **macOS (Apple Silicon)** | [AiDE-0.1.0-aarch64.dmg](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-aarch64.dmg) | — |
| **macOS (Intel)** | [AiDE-0.1.0-x64.dmg](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-x64.dmg) | — |
| **Linux x64** | [AiDE-0.1.0-amd64.AppImage](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-amd64.AppImage) | [AiDE-0.1.0-amd64.deb](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-amd64.deb) |
| **Linux arm64** | [AiDE-0.1.0-arm64.AppImage](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-arm64.AppImage) | [AiDE-0.1.0-arm64.deb](https://github.com/appleweiping/AiDE-dev/releases/latest/download/AiDE-0.1.0-arm64.deb) |
| **CLI (npm)** | `npm install -g @aide-dev/cli` | — |

</p>

> すべてのリリースは [GitHub Releases](https://github.com/appleweiping/AiDE-dev/releases) ページにあります。デスクトップアプリは新バージョンが利用可能になると自動更新を通知します。

---

## AiDEとは？

AiDEは、Claude CodeやCodexの機能を中国語LLMエコシステムにもたらすオープンソースのデスクトップコーディングエージェントです。軽量なTauriシェル（約5MB）でWindows・macOS・Linuxにネイティブ動作し、DeepSeek・Qwen・GLM・Kimi・Doubao・MiniMax、またはOpenAI互換APIエンドポイントに接続できます。ファイル編集・シェル実行・Web検索・Git操作・MCPツールなど、完全なエージェントループがローカルで動作し、3段階の権限システムで常に制御を維持できます。

## なぜAiDEを選ぶのか？

| | Claude Code | Codex | **AiDE** |
|---|---|---|---|
| モデルサポート | Claudeのみ | GPTのみ | **6つの中国語LLM + OpenAI互換API** |
| デスクトップサイズ | Electron (~150 MB) | Electron | **Tauri (~5 MB)** |
| オープンソース | いいえ | 一部 | **はい — Apache-2.0** |
| 中国語最適化 | 基本的 | 基本的 | **ネイティブ中国語UI + 中国語モデルプリセット** |
| カスタムAPIエンドポイント | 回避策が必要 | 回避策が必要 | **ファーストクラスの `base_url` + keyサポート** |
| 価格 | $20/月〜 | $20/月〜 | **従量課金制；中国語モデルで最安¥0.001/回** |
| 思考/推論 | Claude 3.7+ | o1/o3 | **DeepSeek R1、QwQ Plus** |
| ビジョン | Claude 3+ | GPT-4V | **Qwen、GLM、Doubao** |
| コンテキストウィンドウ | 200K | 128K | **最大1Mトークン (MiniMax)** |

## スクリーンショット

<!-- screenshots coming soon -->

---

## 機能

### エージェント機能

AiDEはコーディングワークフロー全体をカバーする15の組み込みツールを搭載しています：

| ツール | 説明 |
|---|---|
| **FileRead** | 行番号オフセット付きでファイルを読み取り；画像・PDF・Jupyterノートブックに対応 |
| **FileWrite** | ファイルをアトミックに作成または上書き |
| **FileEdit** | 精密な文字列置換編集 — 全体の書き直し不要 |
| **Bash** | タイムアウト制御とバックグラウンドモード付きでシェルコマンドを実行 |
| **PowerShell** | BashとSame安全制御を持つWindows PowerShell実行 |
| **Glob** | 大規模コードベースでの高速ファイルパターンマッチング |
| **Grep** | ripgrepによる正規表現コンテンツ検索 |
| **WebSearch** | 最新情報のためのリアルタイムWeb検索 |
| **WebFetch** | エージェント用URLコンテンツの取得と解析 |
| **NotebookEdit** | Jupyter `.ipynb` ファイルの個別セル編集 |
| **Monitor** | バックグラウンドプロセスのstdoutをストリーミング；各行がイベントを発火 |
| **NodeREPL** | 呼び出し間で状態を保持する永続的なJavaScript実行環境 |
| **Cron** | cron式による一回限りまたは定期ジョブのスケジューリング |
| **AskUser** | エージェントループを一時停止し、複数選択の質問をユーザーに提示 |
| **SubAgent** | 独立したサブタスクのための並列サブエージェントを生成 |

### デスクトップアプリケーション

デスクトップアプリはTauri v2 + Reactで構築され、以下のパネルで構成されています：

**チャットとセッション**
- `Chat` — ツール呼び出しレンダリングとDiffプレビュー付きストリーミングメッセージビュー
- `SessionList` — 過去の会話の閲覧・検索・復元
- `SessionTabs` — マルチタブインターフェース (Ctrl+T / Ctrl+W)；右クリックメニューで名前変更・複製・他を閉じる
- `TokenUsage` — ステータスバーにリアルタイムのトークン数と推定コストを表示

**コードレビューとDiff**
- ハンク単位で承認/拒否/編集できるビジュアルDiffビューア
- シンタックスハイライト付きの並列または統合ビュー

**プロジェクト管理**
- `FileExplorer` — クリックで開ける折りたたみ可能なファイルツリー (Ctrl+B)
- `GitPanel` — ブランチ一覧・コミット履歴・ステージングエリア・PR作成
- `WorktreePanel` — 隔離された実験のためのGit Worktreeの作成と切り替え
- `RagPanel` — TF-IDFによるローカルプロジェクトインデックス検索

**自動化とエージェント**
- `Terminal` — 組み込みxterm.jsターミナル (Ctrl+\`)
- `TaskList` — リアルタイム進捗表示付きフローティングタスクリスト
- `SubAgentPanel` — 並列サブエージェント実行の監視と管理
- `McpManager` — MCPツールサーバーの接続・設定・検査
- `PluginMarketplace` — プラグインの閲覧・インストール・更新

**設定とシステム**
- `Settings` — プロバイダー選択・APIキー・モデル・権限モード・テーマ
- `CommandPalette` — ファジー検索コマンドランチャー (Ctrl+Shift+P)
- `ApprovalDialog` — 「選択を記憶」付きの危険な操作承認モーダル
- `UpdateNotification` — バージョンスキップ対応のアプリ内更新バナー
- バックグラウンド動作のためのシステムトレイ統合

### プロバイダーサポート

| プロバイダー | モデル | コンテキストウィンドウ | ツール使用 | 思考 | ビジョン |
|---|---|---|---|---|---|
| **DeepSeek** | deepseek-chat (V3), deepseek-reasoner (R1) | 64K | V3のみ | R1 | いいえ |
| **Qwen (Alibaba)** | qwen-max, qwen-plus, qwq-plus | 32K – 131K | はい | QwQ | はい |
| **GLM (Zhipu)** | glm-4-plus, glm-4-flash | 128K | はい | いいえ | はい |
| **Kimi (Moonshot)** | moonshot-v1-128k, moonshot-v1-32k | 32K – 128K | はい | いいえ | いいえ |
| **Doubao (ByteDance)** | doubao-1.5-pro-256k, doubao-1.5-lite-32k | 32K – 256K | はい | いいえ | はい |
| **MiniMax** | MiniMax-Text-01 | 1,000,000 | はい | いいえ | いいえ |
| **カスタム** | 任意のモデル | 設定可能 | エンドポイント依存 | エンドポイント依存 | エンドポイント依存 |

### 拡張性

- **MCPプロトコル** — 任意のMCPツールサーバーに接続；ツール検出・リソース読み取り・マルチサーバー並列接続を含む完全なクライアント仕様を実装
- **プラグインシステム** — プラグインは標準npmパッケージ；カスタムツール・コマンド・UIパネルを登録可能
- **VS Code拡張** — VS Code内からAiDEエージェントを使用 (Phase 3)
- **OpenAI互換API** — OpenAIチャット補完フォーマットに対応した任意のプロバイダーがそのまま動作

### セキュリティと権限

AiDEは3段階の権限モデルを使用します：

| モード | 動作 |
|---|---|
| **セーフ** (デフォルト) | すべてのファイル書き込みとシェルコマンドに明示的な承認が必要 |
| **トラスト** | 承認済みコマンドは自動実行；新しい高リスク操作のみ確認 |
| **ロック** | 読み取り専用モード；書き込みやシェル実行は不可 |

承認システムはリスクレベルでコマンドを分類し、実行前に完全なコマンドのモーダルを表示し、「この選択を記憶」をサポートします。ファイルサンドボックスは設定された作業ディレクトリ内への書き込みを制限します。

---

## クイックスタート

### 前提条件

- Node.js 22以降
- pnpm 9以降
- Rust stableツールチェーン（Tauriシェルのコンパイル用 — [rustup.rs](https://rustup.rs)でインストール）
- Windows 10+ / macOS 12+ / Ubuntu 20.04+

### インストールと実行

```bash
# リポジトリをクローン
git clone https://github.com/AiDE-dev/aide.git
cd aide

# すべてのワークスペース依存関係をインストール
pnpm install

# 開発モードでデスクトップアプリを起動（ホットリロード）
pnpm --filter @aide/desktop tauri dev

# またはCLIのみ使用（Rust不要）
pnpm --filter @aide/cli dev -- --provider deepseek --key sk-xxx "このプロジェクトのアーキテクチャを説明して"
```

### プロダクションビルド

```bash
# デスクトップインストーラーをビルド
pnpm --filter @aide/desktop tauri build

# 出力場所：
# Windows:  packages/desktop/src-tauri/target/release/bundle/msi/
# macOS:    packages/desktop/src-tauri/target/release/bundle/dmg/
# Linux:    packages/desktop/src-tauri/target/release/bundle/appimage/
```

---

## 設定

### 初回起動

初回起動時に設定パネルを開きます（歯車アイコンまたはCtrl+Shift+P → "Settings"）：

1. ドロップダウンからプロバイダーを選択
2. APIキーを入力
3. モデルを選択
4. 「接続テスト」をクリック

### 設定ファイル

AiDEは設定を `~/.aide/config.toml` に保存します：

```toml
[provider]
id = "deepseek"
base_url = "https://api.deepseek.com"
api_key = "sk-xxx"
model = "deepseek-chat"

[agent]
max_iterations = 50
thinking_enabled = true
permission_mode = "safe"   # safe | trusted | locked

[[mcp.servers]]
name = "filesystem"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "./"]
```

### 環境変数

| 変数 | 説明 |
|---|---|
| `AIDE_PROVIDER` | デフォルトプロバイダーID（例：`deepseek`） |
| `AIDE_API_KEY` | APIキー（設定ファイルを上書き） |
| `AIDE_BASE_URL` | カスタムAPIベースURL |
| `AIDE_MODEL` | 使用するモデルID |
| `AIDE_PERMISSION_MODE` | `safe`、`trusted`、または `locked` |
| `AIDE_WORK_DIR` | エージェントの作業ディレクトリ |
| `AIDE_MAX_ITERATIONS` | エージェントループの最大反復回数（デフォルト：50） |

---

## CLIリファレンス

```bash
aide [オプション] [プロンプト]
```

| フラグ | 短縮形 | 説明 |
|---|---|---|
| `--provider <id>` | `-p` | プロバイダーID：`deepseek`、`qwen`、`glm`、`kimi`、`doubao`、`minimax`、`custom` |
| `--key <key>` | `-k` | APIキー |
| `--base-url <url>` | | カスタムAPIベースURL |
| `--model <id>` | `-m` | モデルID |
| `--dir <path>` | `-d` | 作業ディレクトリ（デフォルト：カレントディレクトリ） |
| `--thinking` | | 思考/推論モードを有効化 |
| `--permission <mode>` | | 権限モード：`safe`、`trusted`、`locked` |
| `--max-iter <n>` | | エージェントの最大反復回数（デフォルト：50） |
| `--interactive` | `-i` | インタラクティブREPLセッションを開始 |
| `--version` | `-v` | バージョンを表示して終了 |
| `--help` | `-h` | ヘルプを表示 |

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                     デスクトップ (Tauri v2)                   │
│  ┌──────────┐ ┌──────┐ ┌──────────┐ ┌───────┐ ┌─────────┐  │
│  │  チャット │ │ Diff │ │  ターミナル│ │ ファイル│ │  設定   │  │
│  │  セッション│ │ ビュー│ │ xterm.js │ │  Git  │ │   MCP   │  │
│  └────┬─────┘ └──┬───┘ └────┬─────┘ └───┬───┘ └────┬────┘  │
│       └──────────┴──────────┴───────────┴──────────┘        │
│                          │ IPC (JSON-RPC over stdio)          │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    コアエンジン (Node.js 22)                  │
│  ┌────────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐  │
│  │  プロバイダー│  │  エージェント│  │   ツール  │  │   MCP   │  │
│  │  レジストリ │  │   ループ  │  │  レジストリ│  │  マネージャ│  │
│  └────────────┘  └───────────┘  └───────────┘  └─────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
       DeepSeek          Qwen           GLM / Kimi / Doubao / MiniMax / Custom
```

### テックスタック

| レイヤー | 技術 | 備考 |
|---|---|---|
| デスクトップシェル | Tauri v2 (Rust) | ネイティブウィンドウ、システムトレイ、IPCブリッジ |
| フロントエンド | React + TypeScript + Tailwind CSS | ダークテーマ、VS Codeカラーパレット |
| ターミナルエミュレータ | xterm.js | 完全なANSIサポート、リサイズ対応 |
| コアエンジン | TypeScript on Node.js 22 | エージェントループ、ツール実行、ストリーミング |
| セッションストレージ | JSON → SQLite (Phase 2) | SQLiteSessionStore実装済み |
| ローカル検索 | TF-IDFインデクサー | ファイルチャンキング、言語検出、シリアライズ可能なインデックス |
| ビルドシステム | pnpm + Turborepo + tsdown | インクリメンタルビルド対応モノレポ |
| CI/CD | GitHub Actions | 3プラットフォームビルドとリリース |

---

## ロードマップ

### Phase 1 — 基盤（完了）

- [x] チャットインターフェース付きデスクトップアプリ
- [x] 6つの中国語LLMプロバイダープリセット
- [x] 完全なツールスイート（15ツール）
- [x] 承認ダイアログ付き3段階権限システム
- [x] セッション永続化 (JSON)
- [x] バイリンガルUI（英語 + 中国語）
- [x] ビジュアルDiffビューア
- [x] プランモード
- [x] コマンドパレット
- [x] MCPクライアント
- [x] プラグインシステム

### Phase 2 — コラボレーション（完了）

- [x] MCPマネージャーUI
- [x] Gitワークフローパネル
- [x] サブエージェント並列タスク実行
- [x] 自動アップデーター
- [x] SQLiteセッションストア
- [x] セッションタブ（マルチタブインターフェース）
- [x] Worktreeパネル

### Phase 3 — インテリジェンス（完了）

- [x] プラグインマーケットプレイス
- [x] Worktreeサンドボックス
- [x] RAGローカルインデックス (TF-IDF)
- [x] VS Code拡張スキャフォールド
- [x] サブエージェントパネルUI

### Phase 4 — 将来

- [ ] モバイルコンパニオンアプリ (iOS / Android)
- [ ] 音声入力とテキスト読み上げ出力
- [ ] コラボレーションモード（共有セッション、マルチユーザー）
- [ ] セッションと設定のクラウド同期
- [ ] 中国語LLM向けファインチューニングツール使用モデル
- [ ] セマンティックRAG（ベクター埋め込み）

---

## コントリビューション

詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

---

## よくある質問

**Q: AiDEを使うには有料サブスクリプションが必要ですか？**
いいえ。AiDEは無料のオープンソースです。選択したプロバイダーへのAPI呼び出し分のみ支払います。DeepSeek V3は1Kトークンあたり約¥0.001 — Claude CodeやCodexのサブスクリプションより桁違いに安価です。

**Q: AiDEは私のコードをサードパーティサーバーに送信しますか？**
AiDEは設定したLLMプロバイダーに明示的に送信したメッセージのみを送ります。テレメトリー・分析・データ収集は一切ありません。エージェントは完全にあなたのマシン上で動作します。

**Q: ローカルモデル（Ollama、LM Studio）と一緒に使えますか？**
はい。プロバイダーとして「Custom」を選択し、ベースURLをローカルサーバー（例：`http://localhost:11434/v1`）に設定し、APIキーに任意の文字列を入力します。ツール使用はローカルモデルがOpenAI function-callingフォーマットをサポートしているかどうかによります。

**Q: AiDEはCursorやWindsurfとどう違いますか？**
CursorとWindsurfは完全なIDE代替品です。AiDEは既存のエディタと並行して動作するスタンドアロンエージェントです。Claude CodeやCodexに近い哲学 — 特定のタスクのために呼び出すターミナル/デスクトップエージェントです。

**Q: Tauriのビルドが失敗します。どうすればいいですか？**
Rust stableツールチェーンがインストールされていることを確認してください（`rustup toolchain install stable`）。Windowsでは、MSVCビルドツール（Visual Studio Build Tools 2022）も必要です。プラットフォーム固有の手順については [Tauri前提条件ガイド](https://tauri.app/start/prerequisites/) を参照してください。

---

## ライセンス

[Apache-2.0](LICENSE) — 商用利用を含め、自由に使用・変更・配布できます。

---

## 謝辞

- [Tauri](https://tauri.app) — 5MBのクロスプラットフォームデスクトップアプリを可能にしてくれたことに感謝
- [React](https://react.dev) とReactエコシステム
- [xterm.js](https://xtermjs.org) — ターミナルエミュレータ
- [DeepSeek](https://deepseek.com)、[Alibaba Cloud](https://www.alibabacloud.com)、[Zhipu AI](https://zhipuai.cn)、[Moonshot AI](https://moonshot.cn)、[ByteDance](https://bytedance.com)、[MiniMax](https://minimax.chat) — 世界クラスのLLMとオープンAPIの構築に感謝
- [Model Context Protocol](https://modelcontextprotocol.io) チーム (Anthropic)
- すべてのコントリビューターとアーリーアダプター
