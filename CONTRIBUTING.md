# AiDE — AI Dev Environment

## 贡献指南

### 开发环境要求

- Node.js 22+
- pnpm 9+
- Rust (stable, for Tauri)
- Windows 10+ / macOS 12+ / Linux

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/your-org/aide.git
cd aide

# 安装依赖
pnpm install

# 启动开发模式（桌面应用）
pnpm --filter @aide/desktop tauri dev

# 仅启动 core 引擎（CLI 模式）
pnpm --filter @aide/cli dev
```

### 项目结构

```
packages/
  shared/   — 共享类型定义和常量
  core/     — Agent 引擎（模型无关）
  desktop/  — Tauri v2 桌面应用
  cli/      — 命令行界面
plugins/    — 内置插件
```

### 提交规范

使用 Conventional Commits:
- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `refactor:` 重构
- `test:` 测试
- `chore:` 构建/工具

### 添加新 Provider

1. 在 `packages/shared/src/constants.ts` 的 `PROVIDER_PRESETS` 中添加预设
2. 如果 API 不兼容 OpenAI 格式，在 `packages/core/src/provider/` 中创建新的 provider 类
3. 在 `packages/core/src/provider/registry.ts` 中注册

### 添加新工具

1. 在 `packages/core/src/tools/` 中创建工具文件
2. 导出 `definition` 和 `execute` 函数
3. 在 `packages/core/src/tools/index.ts` 中注册

### 添加新插件

1. 在 `plugins/` 下创建目录
2. 添加 `package.json`，包含 `aide-plugin` 字段
3. 实现 `activate(context)` 和 `deactivate()` 导出

## License

Apache-2.0
