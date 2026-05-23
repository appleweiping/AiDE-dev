import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProviderConfig, AgentConfig, PermissionMode } from '@aide/shared';
import { PROVIDER_PRESETS, DEFAULT_MAX_ITERATIONS, DEFAULT_THINKING_EFFORT } from '@aide/shared';

export interface AideConfig {
  provider: ProviderConfig;
  agent: {
    maxIterations: number;
    thinkingEnabled: boolean;
    thinkingEffort: 'low' | 'medium' | 'high';
    permissionMode: PermissionMode;
  };
  mcp: {
    servers: Array<{
      name: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }>;
  };
  ui: {
    language: 'zh-CN' | 'en';
    theme: 'dark' | 'light';
    fontSize: number;
    showTokenUsage: boolean;
  };
}

const DEFAULT_CONFIG: AideConfig = {
  provider: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-chat',
  },
  agent: {
    maxIterations: DEFAULT_MAX_ITERATIONS,
    thinkingEnabled: false,
    thinkingEffort: DEFAULT_THINKING_EFFORT,
    permissionMode: 'safe',
  },
  mcp: {
    servers: [],
  },
  ui: {
    language: 'zh-CN',
    theme: 'dark',
    fontSize: 14,
    showTokenUsage: true,
  },
};

export class ConfigManager {
  private config: AideConfig;
  private configDir: string;
  private configPath: string;

  constructor(configDir?: string) {
    this.configDir = configDir || getDefaultConfigDir();
    this.configPath = path.join(this.configDir, 'config.json');
    this.config = this.load();
  }

  private load(): AideConfig {
    if (!fs.existsSync(this.configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const saved = JSON.parse(content);
      return deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, saved) as unknown as AideConfig;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  save(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  get(): AideConfig {
    return this.config;
  }

  set(partial: DeepPartial<AideConfig>): void {
    this.config = deepMerge(this.config as unknown as Record<string, unknown>, partial as unknown as Record<string, unknown>) as unknown as AideConfig;
    this.save();
  }

  getProvider(): ProviderConfig {
    return this.config.provider;
  }

  setProvider(provider: Partial<ProviderConfig>): void {
    Object.assign(this.config.provider, provider);
    this.save();
  }

  getAgentConfig(): AgentConfig {
    return {
      ...this.config.agent,
      workingDirectory: process.cwd(),
      provider: this.config.provider,
    };
  }

  getPresetBaseUrl(providerId: string): string | undefined {
    return PROVIDER_PRESETS.find((p) => p.id === providerId)?.baseUrl;
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
  }
}

function getDefaultConfigDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(home, '.aide');
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}
