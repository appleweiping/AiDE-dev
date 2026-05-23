import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import type { ToolDefinition } from '@aide/shared';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  main: string;
  permissions?: string[];
}

export interface PluginContext {
  registerTool(name: string, definition: ToolDefinition, handler: ToolHandler): void;
  registerCommand(name: string, description: string, handler: CommandHandler): void;
  getConfig<T>(key: string): T | undefined;
  setConfig(key: string, value: unknown): void;
  log(message: string): void;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;
export type CommandHandler = (args?: string) => Promise<void>;

export interface LoadedPlugin {
  manifest: PluginManifest;
  context: PluginContext;
  tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }>;
  commands: Map<string, { description: string; handler: CommandHandler }>;
}

export class PluginManager extends EventEmitter {
  private plugins = new Map<string, LoadedPlugin>();
  private pluginDirs: string[];

  constructor(pluginDirs?: string[]) {
    super();
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.pluginDirs = pluginDirs || [
      path.join(home, '.aide', 'plugins'),
      path.join(process.cwd(), '.aide', 'plugins'),
    ];
  }

  async discover(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    for (const dir of this.pluginDirs) {
      if (!fs.existsSync(dir)) continue;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const manifestPath = path.join(dir, entry.name, 'package.json');
        if (!fs.existsSync(manifestPath)) continue;

        try {
          const pkg = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          if (pkg['aide-plugin']) {
            manifests.push({
              id: pkg.name,
              name: pkg['aide-plugin'].name || pkg.name,
              version: pkg.version,
              description: pkg.description || '',
              author: pkg.author,
              main: path.join(dir, entry.name, pkg.main || 'index.js'),
              permissions: pkg['aide-plugin'].permissions,
            });
          }
        } catch {
          // skip invalid manifests
        }
      }
    }

    return manifests;
  }

  async load(manifest: PluginManifest): Promise<LoadedPlugin> {
    const tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>();
    const commands = new Map<string, { description: string; handler: CommandHandler }>();
    const configStore = new Map<string, unknown>();

    const context: PluginContext = {
      registerTool(name, definition, handler) {
        tools.set(name, { definition, handler });
      },
      registerCommand(name, description, handler) {
        commands.set(name, { description, handler });
      },
      getConfig<T>(key: string): T | undefined {
        return configStore.get(key) as T | undefined;
      },
      setConfig(key: string, value: unknown) {
        configStore.set(key, value);
      },
      log(message: string) {
        // Plugin logs go to event emitter
      },
    };

    try {
      const module = await import(manifest.main);
      if (typeof module.activate === 'function') {
        await module.activate(context);
      }
    } catch (error) {
      throw new Error(`Failed to load plugin ${manifest.id}: ${(error as Error).message}`);
    }

    const loaded: LoadedPlugin = { manifest, context, tools, commands };
    this.plugins.set(manifest.id, loaded);
    this.emit('loaded', manifest.id);

    return loaded;
  }

  async unload(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    try {
      const module = await import(plugin.manifest.main);
      if (typeof module.deactivate === 'function') {
        await module.deactivate();
      }
    } catch {
      // best effort
    }

    this.plugins.delete(pluginId);
    this.emit('unloaded', pluginId);
  }

  async loadAll(): Promise<void> {
    const manifests = await this.discover();
    for (const manifest of manifests) {
      try {
        await this.load(manifest);
      } catch (error) {
        this.emit('loadError', { id: manifest.id, error: (error as Error).message });
      }
    }
  }

  getPlugin(id: string): LoadedPlugin | undefined {
    return this.plugins.get(id);
  }

  getAllTools(): Array<{ pluginId: string; name: string; definition: ToolDefinition; handler: ToolHandler }> {
    const result: Array<{ pluginId: string; name: string; definition: ToolDefinition; handler: ToolHandler }> = [];
    for (const [pluginId, plugin] of this.plugins) {
      for (const [name, { definition, handler }] of plugin.tools) {
        result.push({ pluginId, name: `plugin_${pluginId}_${name}`, definition, handler });
      }
    }
    return result;
  }

  getAllCommands(): Array<{ pluginId: string; name: string; description: string; handler: CommandHandler }> {
    const result: Array<{ pluginId: string; name: string; description: string; handler: CommandHandler }> = [];
    for (const [pluginId, plugin] of this.plugins) {
      for (const [name, { description, handler }] of plugin.commands) {
        result.push({ pluginId, name, description, handler });
      }
    }
    return result;
  }

  listLoaded(): PluginManifest[] {
    return Array.from(this.plugins.values()).map((p) => p.manifest);
  }
}
