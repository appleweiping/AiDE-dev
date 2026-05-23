import { McpClient, type McpServerConfig, type McpTool } from './client.js';
import { EventEmitter } from 'node:events';

export interface McpServerStatus {
  name: string;
  connected: boolean;
  tools: McpTool[];
  error?: string;
}

export class McpManager extends EventEmitter {
  private clients = new Map<string, McpClient>();

  async connect(config: McpServerConfig): Promise<McpServerStatus> {
    if (this.clients.has(config.name)) {
      await this.disconnect(config.name);
    }

    const client = new McpClient(config);

    client.on('exit', (code) => {
      this.emit('serverExit', { name: config.name, code });
      this.clients.delete(config.name);
    });

    client.on('stderr', (data) => {
      this.emit('serverStderr', { name: config.name, data });
    });

    try {
      await client.connect();
      this.clients.set(config.name, client);
      this.emit('connected', config.name);

      return {
        name: config.name,
        connected: true,
        tools: client.availableTools,
      };
    } catch (error) {
      const err = error as Error;
      return {
        name: config.name,
        connected: false,
        tools: [],
        error: err.message,
      };
    }
  }

  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      client.disconnect();
      this.clients.delete(name);
      this.emit('disconnected', name);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const name of this.clients.keys()) {
      await this.disconnect(name);
    }
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    const client = this.clients.get(serverName);
    if (!client) {
      return `Error: MCP server "${serverName}" not connected`;
    }
    if (!client.connected) {
      return `Error: MCP server "${serverName}" disconnected`;
    }
    return client.callTool(toolName, args);
  }

  getAllTools(): Array<{ server: string; tool: McpTool }> {
    const tools: Array<{ server: string; tool: McpTool }> = [];
    for (const [name, client] of this.clients) {
      for (const tool of client.availableTools) {
        tools.push({ server: name, tool });
      }
    }
    return tools;
  }

  getToolDefinitions(): Array<{ name: string; description: string; parameters: Record<string, unknown> }> {
    return this.getAllTools().map(({ server, tool }) => ({
      name: `mcp_${server}_${tool.name}`,
      description: `[MCP:${server}] ${tool.description}`,
      parameters: tool.inputSchema,
    }));
  }

  getStatus(): McpServerStatus[] {
    const statuses: McpServerStatus[] = [];
    for (const [name, client] of this.clients) {
      statuses.push({
        name,
        connected: client.connected,
        tools: client.availableTools,
      });
    }
    return statuses;
  }

  isToolFromMcp(toolName: string): { server: string; tool: string } | null {
    const match = toolName.match(/^mcp_([^_]+)_(.+)$/);
    if (!match) return null;
    return { server: match[1], tool: match[2] };
  }
}
