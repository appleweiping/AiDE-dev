<p align="center">
  <img src="assets/banner.png" alt="AiDE Banner" width="800" />
</p>

<h1 align="center">AiDE — AI 开发环境</h1>

<p align="center">
  <strong>面向国产大模型的桌面编程智能体 — 对标 Claude Code 和 Codex 的全功能开源替代</strong>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
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

## AiDE 是什么？

AiDE 是一个开源桌面编程智能体，将 Claude Code 和 Codex 的能力带到国产大模型生态。基于轻量级 Tauri 外壳（约 5 MB）原生运行于 Windows、macOS 和 Linux，支持接入 DeepSeek、通义千问、智谱 GLM、Kimi、豆包、MiniMax 或任何 OpenAI 兼容 API。完整的智能体循环——文件编辑、Shell 执行、网络搜索、Git 操作、MCP 工具等——全部在本地运行，三级权限系统让你始终掌控全局。

## 为什么选择 AiDE？

| | Claude Code | Codex | **AiDE** |
|---|---|---|---|
| 模型支持 | 仅 Claude | 仅 GPT | **6 大国产模型 + 任意 OpenAI 兼容 API** |
| 桌面体积 | Electron (~150 MB) | Electron | **Tauri (~5 MB)** |
| 开源 | 否 | 部分 | **是 — Apache-2.0** |
| 中文优化 | 基础 | 基础 | **原生中文 UI + 国产模型预设** |
| 自定义 API 端点 | 需要变通 | 需要变通 | **一等公民 `base_url` + key 支持** |
| 定价 | $20/月起 | $20/月起 | **按量付费；国产模型低至 ¥0.001/次调用** |
| 思维链/推理 | Claude 3.7+ | o1/o3 | **DeepSeek R1、QwQ Plus** |
| 视觉能力 | Claude 3+ | GPT-4V | **通义千问、GLM、豆包** |
| 上下文窗口 | 200K | 128K | **最高 1M tokens (MiniMax)** |

## 截图

<!-- screenshots coming soon -->

---

## 功能特性

### 智能体能力

AiDE 内置 15 个工具，覆盖完整编程工作流：

| 工具 | 说明 |
|---|---|
| **FileRead** | 读取任意文件，支持行号偏移；兼容图片、PDF 和 Jupyter Notebook |
| **FileWrite** | 原子性创建或覆盖文件 |
| **FileEdit** | 精确字符串替换编辑——无需全文重写 |
| **Bash** | 执行 Shell 命令，支持超时控制和后台模式 |
| **PowerShell** | Windows PowerShell 执行，具备与 Bash 相同的安全控制 |
| **Glob** | 大型代码库中的快速文件模式匹配 |
| **Grep** | 基于 ripgrep 的正则内容搜索 |
| **WebSearch** | 实时网络搜索获取最新信息 |
| **WebFetch** | 抓取并解析 URL 内容 |
| **NotebookEdit** | 编辑 Jupyter `.ipynb` 文件的单个 Cell |
| **Monitor** | 流式监听后台进程的 stdout，每行触发一个事件 |
| **NodeREPL** | 持久化 JavaScript 执行环境，跨调用保持状态 |
| **Cron** | 使用 cron 表达式调度一次性或周期性任务 |
| **AskUser** | 暂停智能体循环，向用户展示多选题 |
| **SubAgent** | 为独立子任务生成并行子智能体 |

### 桌面应用

桌面应用基于 Tauri v2 + React 构建，包含以下面板：

**对话与会话**
- `Chat` — 流式消息视图，支持工具调用渲染和 Diff 预览
- `SessionList` — 浏览、搜索和恢复历史对话
- `SessionTabs` — 多标签页界面 (Ctrl+T / Ctrl+W)；右键菜单支持重命名、复制、关闭其他
- `TokenUsage` — 状态栏实时显示输入/输出 Token 计数和预估费用

**代码审查与 Diff**
- 可视化 Diff 查看器，支持按 Hunk 逐行接受/拒绝/编辑
- 语法高亮的并排或统一视图

**项目管理**
- `FileExplorer` — 可折叠文件树，点击即可打开 (Ctrl+B)
- `GitPanel` — 分支列表、提交历史、暂存区、PR 创建
- `WorktreePanel` — 创建和切换 Git Worktree 进行隔离实验
- `RagPanel` — 基于 TF-IDF 的本地项目索引搜索

**自动化与智能体**
- `Terminal` — 内嵌 xterm.js 终端 (Ctrl+\`)
- `TaskList` — 浮动任务清单，实时显示进度
- `SubAgentPanel` — 监控和管理并行子智能体运行
- `McpManager` — 连接、配置和检查 MCP 工具服务器
- `PluginMarketplace` — 浏览、安装和更新插件

**设置与系统**
- `Settings` — 提供商选择、API Key、模型、权限模式、主题
- `CommandPalette` — 模糊搜索命令启动器 (Ctrl+Shift+P)
- `ApprovalDialog` — 危险操作审批弹窗，支持"记住选择"
- `UpdateNotification` — 应用内更新横幅，支持跳过版本
- 系统托盘集成，支持后台运行

### 提供商支持

| 提供商 | 模型 | 上下文窗口 | 工具调用 | 思维链 | 视觉 |
|---|---|---|---|---|---|
| **DeepSeek** | deepseek-chat (V3), deepseek-reasoner (R1) | 64K | 仅 V3 | R1 | 否 |
| **通义千问 (阿里)** | qwen-max, qwen-plus, qwq-plus | 32K – 131K | 是 | QwQ | 是 |
| **智谱 GLM** | glm-4-plus, glm-4-flash | 128K | 是 | 否 | 是 |
| **Kimi (月之暗面)** | moonshot-v1-128k, moonshot-v1-32k | 32K – 128K | 是 | 否 | 否 |
| **豆包 (字节跳动)** | doubao-1.5-pro-256k, doubao-1.5-lite-32k | 32K – 256K | 是 | 否 | 是 |
| **MiniMax** | MiniMax-Text-01 | 1,000,000 | 是 | 否 | 否 |
| **自定义** | 任意模型 | 可配置 | 取决于端点 | 取决于端点 | 取决于端点 |

### 可扩展性

- **MCP 协议** — 连接任意 MCP 工具服务器；AiDE 实现完整客户端规范，包括工具发现、资源读取和多服务器并行连接
- **插件系统** — 插件是标准 npm 包；可注册自定义工具、命令和 UI 面板
- **VS Code 扩展** — 在 VS Code 内使用 AiDE 智能体（Phase 3）
- **OpenAI 兼容 API** — 任何支持 OpenAI Chat Completions 格式的提供商均可开箱即用

### 安全与权限

AiDE 采用三级权限模型：

| 模式 | 行为 |
|---|---|
| **安全模式** (默认) | 所有文件写入和 Shell 命令均需显式批准 |
| **信任模式** | 已批准的命令自动执行；仅新的高风险操作需要确认 |
| **锁定模式** | 只读模式；不允许写入或 Shell 执行 |

审批系统按风险等级分类命令，执行前展示完整命令的弹窗，并支持"记住本次选择"。文件沙箱将写入限制在配置的工作目录内。

---

## 快速开始

### 前置条件

- Node.js 22 或更高版本
- pnpm 9 或更高版本
- Rust stable 工具链（用于编译 Tauri 外壳 — 通过 [rustup.rs](https://rustup.rs) 安装）
- Windows 10+ / macOS 12+ / Ubuntu 20.04+

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/AiDE-dev/aide.git
cd aide

# 安装所有工作区依赖
pnpm install

# 以开发模式启动桌面应用（热重载）
pnpm --filter @aide/desktop tauri dev

# 或仅使用 CLI（无需 Rust）
pnpm --filter @aide/cli dev -- --provider deepseek --key sk-xxx "解释这个项目的架构"
```

### 生产构建

```bash
# 构建桌面安装包
pnpm --filter @aide/desktop tauri build

# 输出位置：
# Windows:  packages/desktop/src-tauri/target/release/bundle/msi/
# macOS:    packages/desktop/src-tauri/target/release/bundle/dmg/
# Linux:    packages/desktop/src-tauri/target/release/bundle/appimage/
```

---

## 配置

### 首次启动

首次启动时，打开设置面板（齿轮图标或 Ctrl+Shift+P → "Settings"）：

1. 从下拉菜单选择提供商
2. 输入 API Key
3. 选择模型
4. 点击"测试连接"

### 配置文件

AiDE 将配置存储在 `~/.aide/config.toml`：

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

[[mcp.servers]]
name = "github"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]
env = { GITHUB_TOKEN = "ghp_xxx" }
```

### 环境变量

| 变量 | 说明 |
|---|---|
| `AIDE_PROVIDER` | 默认提供商 ID（如 `deepseek`） |
| `AIDE_API_KEY` | API Key（覆盖配置文件） |
| `AIDE_BASE_URL` | 自定义 API 基础 URL |
| `AIDE_MODEL` | 使用的模型 ID |
| `AIDE_PERMISSION_MODE` | `safe`、`trusted` 或 `locked` |
| `AIDE_WORK_DIR` | 智能体工作目录 |
| `AIDE_MAX_ITERATIONS` | 智能体循环最大迭代次数（默认：50） |

### 提供商配置指南

<details>
<summary>DeepSeek</summary>

1. 在 [platform.deepseek.com](https://platform.deepseek.com) 注册
2. 在"API Keys"下创建 API Key
3. 在 AiDE 设置中选择 **DeepSeek** 并粘贴 Key
4. 推荐模型：`deepseek-chat` 用于编程任务，`deepseek-reasoner` 用于复杂推理

</details>

<details>
<summary>通义千问 (阿里云)</summary>

1. 在 [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com) 注册
2. 开通 DashScope 并创建 API Key
3. 在 AiDE 设置中选择 **Qwen**
4. 推荐：`qwq-plus` 用于推理，`qwen-plus` 用于长上下文任务 (131K)

</details>

<details>
<summary>智谱 GLM</summary>

1. 在 [open.bigmodel.cn](https://open.bigmodel.cn) 注册
2. 在控制台创建 API Key
3. 在 AiDE 设置中选择 **GLM**
4. `glm-4-plus` 支持 128K 上下文和视觉能力

</details>

<details>
<summary>Kimi (月之暗面)</summary>

1. 在 [platform.moonshot.cn](https://platform.moonshot.cn) 注册
2. 创建 API Key
3. 在 AiDE 设置中选择 **Kimi**
4. `moonshot-v1-128k` 适合大型代码库

</details>

<details>
<summary>豆包 (字节跳动)</summary>

1. 在 [console.volcengine.com/ark](https://console.volcengine.com/ark) 注册
2. 在 Ark 控制台创建 API Key
3. 在 AiDE 设置中选择 **Doubao**
4. `doubao-1.5-pro-256k` 提供 256K 上下文和视觉支持

</details>

<details>
<summary>MiniMax</summary>

1. 在 [platform.minimaxi.com](https://platform.minimaxi.com) 注册
2. 创建 API Key
3. 在 AiDE 设置中选择 **MiniMax**
4. `MiniMax-Text-01` 提供 1M Token 上下文窗口

</details>

<details>
<summary>自定义 / 自托管</summary>

任何 OpenAI 兼容端点均可使用。在 AiDE 设置中选择 **Custom** 并填写：
- 基础 URL（如 `http://localhost:11434/v1` 用于 Ollama）
- API Key（如果端点不需要，填任意字符串）
- 模型 ID

</details>

---

## CLI 参考

```bash
aide [选项] [提示词]
```

| 参数 | 缩写 | 说明 |
|---|---|---|
| `--provider <id>` | `-p` | 提供商 ID：`deepseek`、`qwen`、`glm`、`kimi`、`doubao`、`minimax`、`custom` |
| `--key <key>` | `-k` | API Key |
| `--base-url <url>` | | 自定义 API 基础 URL（用于自定义提供商） |
| `--model <id>` | `-m` | 模型 ID |
| `--dir <path>` | `-d` | 工作目录（默认：当前目录） |
| `--thinking` | | 启用思维链/推理模式 |
| `--permission <mode>` | | 权限模式：`safe`、`trusted`、`locked` |
| `--max-iter <n>` | | 智能体最大迭代次数（默认：50） |
| `--interactive` | `-i` | 启动交互式 REPL 会话 |
| `--version` | `-v` | 打印版本并退出 |
| `--help` | `-h` | 显示帮助 |

**示例：**

```bash
# 一次性任务
aide "给 src/utils.ts 添加单元测试" --provider deepseek --key sk-xxx

# 交互式会话
aide -p qwen -k sk-xxx -i

# 自定义端点（如本地 Ollama）
aide --base-url http://localhost:11434/v1 --key ollama --model llama3.2 "重构这个文件"

# 指定工作目录
aide -d /path/to/project "添加 README"

# 启用推理模式
aide --thinking --provider deepseek --key sk-xxx "设计一个分布式缓存"

# 信任模式（减少审批提示）
aide --permission trusted -p deepseek -k sk-xxx "运行测试套件并修复失败用例"
```

---

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     桌面层 (Tauri v2)                         │
│  ┌──────────┐ ┌──────┐ ┌──────────┐ ┌───────┐ ┌─────────┐  │
│  │   对话   │ │ Diff │ │  终端    │ │ 文件  │ │  设置   │  │
│  │   会话   │ │ 视图 │ │ xterm.js │ │  Git  │ │   MCP   │  │
│  └────┬─────┘ └──┬───┘ └────┬─────┘ └───┬───┘ └────┬────┘  │
│       └──────────┴──────────┴───────────┴──────────┘        │
│                          │ IPC (JSON-RPC over stdio)          │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    核心引擎 (Node.js 22)                      │
│  ┌────────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐  │
│  │  提供商    │  │  智能体   │  │   工具    │  │   MCP   │  │
│  │  注册表    │  │   循环    │  │  注册表   │  │  管理器 │  │
│  └────────────┘  └───────────┘  └───────────┘  └─────────┘  │
│  ┌────────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐  │
│  │   会话     │  │   安全    │  │   插件    │  │   Git   │  │
│  │   管理器   │  │   沙箱    │  │   系统    │  │   操作  │  │
│  └────────────┘  └───────────┘  └───────────┘  └─────────┘  │
│  ┌────────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐  │
│  │    RAG     │  │  子智能体 │  │   计划    │  │  自动   │  │
│  │   索引器   │  │   管理器  │  │   管理器  │  │  更新   │  │
│  └────────────┘  └───────────┘  └───────────┘  └─────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
       DeepSeek          Qwen           GLM / Kimi / Doubao / MiniMax / Custom
```

### 技术栈

| 层级 | 技术 | 备注 |
|---|---|---|
| 桌面外壳 | Tauri v2 (Rust) | 原生窗口、系统托盘、IPC 桥接 |
| 前端 | React + TypeScript + Tailwind CSS | 暗色主题，VS Code 配色 |
| 终端模拟器 | xterm.js | 完整 ANSI 支持，感知窗口大小变化 |
| 核心引擎 | TypeScript on Node.js 22 | 智能体循环、工具执行、流式输出 |
| 会话存储 | JSON 文件 → SQLite (Phase 2) | SQLiteSessionStore 已实现 |
| 本地搜索 | TF-IDF 索引器 | 文件分块、语言检测、可序列化索引 |
| 构建系统 | pnpm + Turborepo + tsdown | Monorepo 增量构建 |
| CI/CD | GitHub Actions | 三平台构建与发布 |

### 包结构

| 包名 | 路径 | 说明 |
|---|---|---|
| `@aide/core` | `packages/core` | 智能体循环、全部工具、提供商、MCP、插件、RAG |
| `@aide/shared` | `packages/shared` | 跨包共享的类型、常量、提供商预设 |
| `@aide/desktop` | `packages/desktop` | Tauri + React 桌面应用 |
| `@aide/cli` | `packages/cli` | 命令行界面 |
| `@aide/vscode` | `packages/vscode` | VS Code 扩展 (Phase 3) |

---

## 工具对照表

全部 15 个内置工具及其 Claude Code / Codex 对应关系：

| 工具 | 说明 | CC 对应 | Codex 对应 |
|---|---|---|---|
| `FileRead` | 读取文件，支持偏移/限制；处理图片、PDF、Notebook | `Read` | `read_file` |
| `FileWrite` | 创建或覆盖文件 | `Write` | `write_file` |
| `FileEdit` | 精确字符串替换编辑（字符串不唯一则失败） | `Edit` | `edit_file` |
| `Bash` | 运行 Shell 命令；支持后台和超时 | `Bash` | `shell` |
| `PowerShell` | Windows PowerShell 执行 | `PowerShell` | — |
| `Glob` | 文件模式匹配，按修改时间排序 | `Glob` | `glob` |
| `Grep` | 基于 ripgrep 的正则内容搜索；支持上下文行 | `Grep` | `grep` |
| `WebSearch` | 实时网络搜索 | `WebSearch` | `web_search` |
| `WebFetch` | 抓取并提取 URL 内容 | `WebFetch` | `web_fetch` |
| `NotebookEdit` | 编辑、插入或删除 Jupyter Notebook Cell | `NotebookEdit` | — |
| `Monitor` | 流式监听后台进程的 stdout | `Monitor` | — |
| `NodeREPL` | 持久化 JavaScript REPL，跨调用保持状态 | — | `repl` |
| `Cron` | 使用 cron 表达式调度任务 | — | — |
| `AskUser` | 暂停并向用户展示多选题 | — | — |
| `SubAgent` | 为独立子任务生成并行子智能体 | — | — |

---

## 快捷键

| 快捷键 | 操作 |
|---|---|
| `Ctrl+Shift+P` | 打开命令面板 |
| `Ctrl+B` | 切换文件浏览器侧边栏 |
| `Ctrl+\`` | 切换内嵌终端 |
| `Ctrl+T` | 新建会话标签页 |
| `Ctrl+W` | 关闭当前会话标签页 |
| `Ctrl+Enter` | 发送消息（在聊天输入框中） |
| `Escape` | 关闭弹窗 / 命令面板 |
| `Ctrl+L` | 清除当前会话消息 |

---

## 插件开发

插件是标准 npm 包，通过导出 manifest 并向 AiDE 核心引擎注册工具或命令来工作。

### 最小插件示例

```typescript
// package.json
{
  "name": "aide-plugin-hello",
  "version": "1.0.0",
  "main": "dist/index.js",
  "aidePlugin": true
}

// src/index.ts
import type { PluginContext, PluginManifest } from '@aide/core';

export const manifest: PluginManifest = {
  id: 'hello',
  name: 'Hello Plugin',
  version: '1.0.0',
  description: '一个最小的 AiDE 插件示例',
};

export async function activate(ctx: PluginContext) {
  ctx.tools.register({
    name: 'hello_world',
    description: '向用户打招呼',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '要问候的名字' },
      },
      required: ['name'],
    },
    async execute({ name }) {
      return { content: `你好，${name}！` };
    },
  });
}
```

### 安装插件

```bash
# 从 npm 安装
aide plugin install aide-plugin-hello

# 从本地路径安装
aide plugin install ./my-plugin

# 通过插件市场 UI
# 打开命令面板 → "Open Plugin Marketplace"
```

### 插件 API

`PluginContext` 对象提供：

- `ctx.tools` — 注册和注销工具
- `ctx.commands` — 注册命令面板条目
- `ctx.sessions` — 读写会话数据
- `ctx.config` — 读取插件配置
- `ctx.events` — 订阅智能体生命周期事件

---

## MCP 集成

AiDE 实现了完整的 [Model Context Protocol](https://modelcontextprotocol.io) 客户端规范。连接任意 MCP 服务器即可扩展智能体的工具和资源。

### 配置

在 `~/.aide/config.toml` 中添加服务器：

```toml
[[mcp.servers]]
name = "filesystem"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]

[[mcp.servers]]
name = "github"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]
env = { GITHUB_TOKEN = "ghp_xxx" }

[[mcp.servers]]
name = "postgres"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
```

### 支持的 MCP 功能

- 工具发现与调用
- 资源读取（文件、数据库记录、API 响应）
- 多服务器并行连接
- 通过 MCP Manager UI 监控服务器健康状态

### MCP 管理器 UI

从侧边栏标题或命令面板 → "Open MCP Manager" 打开 MCP 管理器。你可以：

- 添加和移除服务器
- 查看每个服务器的连接状态和工具列表
- 重启失败的服务器
- 检查工具 Schema

---

## VS Code 扩展

AiDE VS Code 扩展（Phase 3）让你可以直接在编辑器中运行智能体。

### 安装

```bash
# 从 VS Code Marketplace 安装（上线后可用）
code --install-extension aide-dev.aide

# 或手动安装 .vsix
code --install-extension aide-0.1.0.vsix
```

### 使用方式

- 从活动栏打开 AiDE 面板
- 扩展复用你的 `~/.aide/config.toml` 配置
- 全部 15 个工具可用，工作区根目录作为工作目录
- Diff 使用 VS Code 原生 Diff 查看器内联显示

---

## 路线图

### Phase 1 — 基础（已完成）

- [x] 带聊天界面的桌面应用
- [x] 6 大国产模型提供商预设
- [x] 完整工具套件（15 个工具）
- [x] 三级权限系统与审批弹窗
- [x] 会话持久化 (JSON)
- [x] 双语 UI（英文 + 中文）
- [x] 可视化 Diff 查看器
- [x] 计划模式
- [x] 命令面板
- [x] MCP 客户端
- [x] 插件系统

### Phase 2 — 协作（已完成）

- [x] MCP 管理器 UI
- [x] Git 工作流面板（分支、提交、PR）
- [x] 子智能体并行任务执行
- [x] 自动更新器
- [x] SQLite 会话存储
- [x] 会话标签页（多标签界面）
- [x] Worktree 面板

### Phase 3 — 智能化（已完成）

- [x] 插件市场
- [x] Worktree 沙箱
- [x] RAG 本地索引 (TF-IDF)
- [x] VS Code 扩展脚手架
- [x] 子智能体面板 UI

### Phase 4 — 未来

- [ ] 移动端伴侣应用 (iOS / Android)
- [ ] 语音输入和文字转语音输出
- [ ] 协作模式（共享会话、多用户）
- [ ] 云端同步会话和设置
- [ ] 针对国产模型微调的工具调用模型
- [ ] 语义 RAG（向量嵌入，不仅是 TF-IDF）

---

## 贡献

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 添加新提供商

所有国产模型使用 OpenAI 兼容的 Chat Completions 格式。要添加新提供商，在 `packages/shared/src/constants.ts` 的 `PROVIDER_PRESETS` 数组中追加条目：

```typescript
{
  id: 'myprovider',
  name: 'My Provider',
  nameZh: '我的提供商',
  baseUrl: 'https://api.myprovider.com/v1',
  supportsToolUse: true,
  supportsThinking: false,
  supportsVision: false,
  models: [
    { id: 'my-model-v1', name: 'My Model V1', contextWindow: 128000, supportsToolUse: true, supportsThinking: false },
  ],
}
```

### 添加新工具

1. 创建 `packages/core/src/tools/my-tool.ts` 并导出 `ToolDefinition` 和 `execute` 函数
2. 从 `packages/core/src/tools/index.ts` 导出
3. 从 `packages/core/src/index.ts` 导出
4. 在本 README 的工具对照表中添加条目

---

## 常见问题

**Q: 使用 AiDE 需要付费订阅吗？**
不需要。AiDE 免费开源。你只需为调用所选提供商的 API 付费。DeepSeek V3 每 1K Token 约 ¥0.001——比 Claude Code 或 Codex 的订阅费低几个数量级。

**Q: AiDE 会将我的代码发送到第三方服务器吗？**
AiDE 仅将你明确发送的消息传给你配置的 LLM 提供商。无遥测、无分析、无数据收集。智能体完全在你的机器上运行。

**Q: 可以配合本地模型（Ollama、LM Studio）使用吗？**
可以。选择"Custom"作为提供商，将基础 URL 设为本地服务器（如 `http://localhost:11434/v1`），API Key 填任意字符串。工具调用能力取决于你的本地模型是否支持 OpenAI function-calling 格式。

**Q: AiDE 和 Cursor、Windsurf 有什么区别？**
Cursor 和 Windsurf 是完整的 IDE 替代品。AiDE 是独立的智能体，与你现有的编辑器协同工作。它在理念上更接近 Claude Code 或 Codex——一个你为特定任务调用的终端/桌面智能体。

**Q: Tauri 构建在我的机器上失败了怎么办？**
确保已安装 Rust stable 工具链（`rustup toolchain install stable`）。在 Windows 上还需要 MSVC 构建工具（Visual Studio Build Tools 2022）。详见 [Tauri 前置条件指南](https://tauri.app/start/prerequisites/)。

**Q: 可以同时使用多个提供商吗？**
单个会话内不行，但你可以在会话之间切换提供商，或在 `config.toml` 中配置回退链。子智能体任务可以使用与主智能体不同的提供商。

---

## 许可证

[Apache-2.0](LICENSE) — 可自由使用、修改和分发，包括商业用途。

---

## 致谢

- [Tauri](https://tauri.app) — 让 5 MB 跨平台桌面应用成为可能
- [React](https://react.dev) 及 React 生态
- [xterm.js](https://xtermjs.org) — 终端模拟器
- [DeepSeek](https://deepseek.com)、[阿里云](https://www.alibabacloud.com)、[智谱 AI](https://zhipuai.cn)、[月之暗面](https://moonshot.cn)、[字节跳动](https://bytedance.com) 和 [MiniMax](https://minimax.chat) — 构建世界级大模型和开放 API
- [Model Context Protocol](https://modelcontextprotocol.io) 团队 (Anthropic)
- 所有贡献者和早期用户
