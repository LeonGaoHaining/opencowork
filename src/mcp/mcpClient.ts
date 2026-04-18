import { spawn, ChildProcess, ChildProcessWithoutNullStreams } from 'child_process';
import { loadMCPConfig } from './mcpConfig';
import { getMCPSamplingService, MCPSamplingRequest } from './mcpSampling';

type MCPHttpClient = {
  connect: (transport: unknown) => Promise<void>;
  listTools: () => Promise<{
    tools: Array<{
      name: string;
      description?: string;
      inputSchema: object;
    }>;
  }>;
  callTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<unknown>;
  readResource: (params: { uri: string }) => Promise<unknown>;
};

type MCPHttpTransport = {
  close: () => Promise<void>;
};

export interface MCPServerConfig {
  transport?: 'stdio' | 'streamable-http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  auto_reload?: boolean;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: object;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPServerState {
  name: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  tools: MCPTool[];
  connectedAt?: number;
  error?: string;
}

interface MCPPendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
}

interface MCPStdIOState {
  buffer: string;
  pending: Map<string, MCPPendingRequest>;
}

type ToolsChangedListener = (serverName: string, tools: MCPTool[]) => void;

function resolveTransport(config: MCPServerConfig): 'stdio' | 'streamable-http' | null {
  if (config.transport === 'stdio' || config.transport === 'streamable-http') {
    return config.transport;
  }
  if (config.command) {
    return 'stdio';
  }
  if (config.url) {
    return 'streamable-http';
  }
  return null;
}

export class MCPClient {
  private servers: Map<string, MCPServerState> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private httpClients: Map<string, MCPHttpClient> = new Map();
  private httpTransports: Map<string, MCPHttpTransport> = new Map();
  private allTools: Map<string, MCPTool> = new Map();
  private config: Map<string, MCPServerConfig> = new Map();
  private stdioState: Map<string, MCPStdIOState> = new Map();
  private toolsChangedListeners: Set<ToolsChangedListener> = new Set();
  private autoReloadTimers: Map<string, NodeJS.Timeout> = new Map();

  async connect(serverName: string, config: MCPServerConfig): Promise<void> {
    try {
      this.servers.set(serverName, {
        name: serverName,
        status: 'connecting',
        tools: [],
      });
      this.config.set(serverName, config);

      const transport = resolveTransport(config);

      if (transport === 'stdio') {
        await this.connectStdinServer(serverName, config);
      } else if (transport === 'streamable-http') {
        await this.connectHttpServer(serverName, config);
      } else {
        throw new Error('MCP server config requires either command or url');
      }

      this.startAutoReload(serverName);

      this.servers.set(serverName, {
        ...this.servers.get(serverName)!,
        status: 'connected',
        connectedAt: Date.now(),
      });

      console.log(`[MCPClient] Connected to server: ${serverName}`);
    } catch (error) {
      this.servers.set(serverName, {
        name: serverName,
        status: 'error',
        tools: [],
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      throw error;
    }
  }

  private async connectStdinServer(serverName: string, config: MCPServerConfig): Promise<void> {
    const { command, args = [], env = {} } = config;

    return new Promise((resolve, reject) => {
      if (!command) {
        reject(new Error('MCP command is required for stdio server'));
        return;
      }

      const child: ChildProcessWithoutNullStreams = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.processes.set(serverName, child);
      this.stdioState.set(serverName, {
        buffer: '',
        pending: new Map(),
      });

      child.stdout.on('data', (data: Buffer) => {
        const shouldResolve = this.handleStdoutChunk(serverName, data.toString());
        if (shouldResolve) {
          resolve();
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        console.error(`[MCPClient] ${serverName} stderr:`, data.toString());
      });

      child.on('error', (error: Error) => {
        reject(error);
      });

      child.on('exit', (code: number | null) => {
        if (code !== 0) {
          console.error(`[MCPClient] ${serverName} exited with code:`, code);
        }
        this.disconnect(serverName);
      });

      setTimeout(() => reject(new Error('Connection timeout')), 10000);

      void this.sendStdioRequest(serverName, 'tools/list', {}, 5000)
        .then((response) => {
          const tools = this.extractToolsResponse(response);
          if (tools.length > 0) {
            this.registerTools(serverName, tools);
            resolve();
          }
        })
        .catch(() => {
          // fall back to waiting for unsolicited tool list from server stdout
        });
    });
  }

  private handleStdoutChunk(serverName: string, chunk: string): boolean {
    const state = this.stdioState.get(serverName);
    if (!state) return false;

    state.buffer += chunk;
    let resolvedInit = false;

    const processMessage = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      try {
        const message = JSON.parse(trimmed);
        if (message.method === 'sampling/createMessage' && message.id) {
          void this.handleSamplingNotification(serverName, message);
          return;
        }

        if (message.method === 'notifications/tools/list_changed') {
          void this.refreshTools(serverName);
          return;
        }

        if (message.id && state.pending.has(String(message.id))) {
          const pending = state.pending.get(String(message.id))!;
          clearTimeout(pending.timeout);
          state.pending.delete(String(message.id));
          pending.resolve(message.result ?? message);
          return;
        }

        const tools = this.extractToolsResponse(message);
        if (tools.length > 0) {
          this.registerTools(serverName, tools);
          resolvedInit = true;
        }
      } catch {
        // keep buffering until valid JSON is available
      }
    };

    const lines = state.buffer.split('\n');
    state.buffer = lines.pop() || '';
    for (const line of lines) {
      processMessage(line);
    }

    try {
      const parsed = JSON.parse(state.buffer);
      processMessage(JSON.stringify(parsed));
      state.buffer = '';
    } catch {
      // partial JSON remains buffered
    }

    return resolvedInit;
  }

  private extractToolsResponse(response: any): MCPTool[] {
    if (Array.isArray(response?.tools)) {
      return response.tools;
    }
    if (Array.isArray(response?.result?.tools)) {
      return response.result.tools;
    }
    if (Array.isArray(response?.result)) {
      return response.result;
    }
    return [];
  }

  private async handleSamplingNotification(serverName: string, message: any): Promise<void> {
    try {
      const samplingService = getMCPSamplingService();
      const result = await samplingService.handleSamplingRequest(
        message.params as MCPSamplingRequest
      );
      const process = this.processes.get(serverName) as ChildProcessWithoutNullStreams | undefined;
      process?.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, result })}\n`);
    } catch (error: any) {
      const process = this.processes.get(serverName) as ChildProcessWithoutNullStreams | undefined;
      process?.stdin.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          error: { message: error.message || 'Sampling failed' },
        })}\n`
      );
    }
  }

  private startAutoReload(serverName: string): void {
    this.stopAutoReload(serverName);
    const serverConfig = loadMCPConfig().servers[serverName];
    if (!serverConfig?.auto_reload) {
      return;
    }

    const timer = setInterval(() => {
      void this.refreshTools(serverName).catch((error) => {
        console.warn(`[MCPClient] Auto reload failed for ${serverName}:`, error);
      });
    }, 15000);
    this.autoReloadTimers.set(serverName, timer);
  }

  private stopAutoReload(serverName: string): void {
    const timer = this.autoReloadTimers.get(serverName);
    if (timer) {
      clearInterval(timer);
      this.autoReloadTimers.delete(serverName);
    }
  }

  async refreshTools(serverName: string): Promise<MCPTool[]> {
    const tools = await this.listTools(serverName);
    this.notifyToolsChanged(serverName, tools);
    return tools;
  }

  onToolsChanged(callback: ToolsChangedListener): () => void {
    this.toolsChangedListeners.add(callback);
    return () => {
      this.toolsChangedListeners.delete(callback);
    };
  }

  private notifyToolsChanged(serverName: string, tools: MCPTool[]): void {
    for (const listener of this.toolsChangedListeners) {
      try {
        listener(serverName, tools);
      } catch (error) {
        console.error('[MCPClient] Tools changed listener error:', error);
      }
    }
  }

  private async sendStdioRequest(
    serverName: string,
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number
  ): Promise<unknown> {
    const process = this.processes.get(serverName) as ChildProcessWithoutNullStreams | undefined;
    const state = this.stdioState.get(serverName);
    if (!process || !state) {
      throw new Error(`Stdio server ${serverName} is not connected`);
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        state.pending.delete(id);
        reject(new Error(`MCP stdio request timeout: ${method}`));
      }, timeoutMs);

      state.pending.set(id, { resolve, reject, timeout });
      process.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  private async connectHttpServer(serverName: string, config: MCPServerConfig): Promise<void> {
    if (!config.url) {
      throw new Error('MCP URL is required for HTTP server');
    }

    const [{ Client }, { StreamableHTTPClientTransport }] = await Promise.all([
      import('@modelcontextprotocol/sdk/client/index.js'),
      import('@modelcontextprotocol/sdk/client/streamableHttp.js'),
    ]);

    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: {
        headers: config.headers,
      },
    });
    const client = new Client({
      name: 'OpenCowork',
      version: '0.10.9',
    });

    await client.connect(transport);

    this.httpClients.set(serverName, client as unknown as MCPHttpClient);
    this.httpTransports.set(serverName, transport as unknown as MCPHttpTransport);

    const tools = await this.listToolsFromHttpClient(serverName);
    this.registerTools(serverName, tools);
  }

  private async listToolsFromHttpClient(serverName: string): Promise<MCPTool[]> {
    const client = this.httpClients.get(serverName);
    if (!client) {
      throw new Error(`HTTP server ${serverName} is not connected`);
    }

    const result = await client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  private registerTools(serverName: string, tools: MCPTool[]): void {
    const serverState = this.servers.get(serverName);
    if (!serverState) return;

    serverState.tools = tools;

    for (const [toolName] of this.allTools) {
      if (toolName.startsWith(`mcp_${serverName}_`)) {
        this.allTools.delete(toolName);
      }
    }

    for (const tool of tools) {
      const fullName = `mcp_${serverName}_${tool.name}`;
      this.allTools.set(fullName, {
        ...tool,
        name: fullName,
      });
    }

    this.notifyToolsChanged(serverName, tools);
  }

  async disconnect(serverName: string): Promise<void> {
    const process = this.processes.get(serverName);
    if (process) {
      process.kill();
      this.processes.delete(serverName);
    }

    const httpTransport = this.httpTransports.get(serverName);
    if (httpTransport) {
      await httpTransport.close().catch((error) => {
        console.warn(`[MCPClient] Failed to close HTTP transport for ${serverName}:`, error);
      });
      this.httpTransports.delete(serverName);
    }
    this.httpClients.delete(serverName);

    this.stdioState.delete(serverName);
    this.stopAutoReload(serverName);

    for (const [toolName] of this.allTools) {
      if (toolName.startsWith(`mcp_${serverName}_`)) {
        this.allTools.delete(toolName);
      }
    }

    this.servers.set(serverName, {
      name: serverName,
      status: 'disconnected',
      tools: [],
    });

    this.notifyToolsChanged(serverName, []);

    console.log(`[MCPClient] Disconnected from server: ${serverName}`);
  }

  async callTool(serverName: string, tool: string, args: unknown): Promise<unknown> {
    const serverState = this.servers.get(serverName);
    if (!serverState || serverState.status !== 'connected') {
      throw new Error(`Server ${serverName} is not connected`);
    }

    const config = this.config.get(serverName);
    if (!config) {
      throw new Error(`No config found for server ${serverName}`);
    }

    if (resolveTransport(config) === 'stdio') {
      return this.sendStdioRequest(
        serverName,
        'tools/call',
        { name: tool, arguments: (args as Record<string, unknown>) || {} },
        30000
      );
    }

    const httpClient = this.httpClients.get(serverName);
    if (httpClient) {
      return httpClient.callTool({
        name: tool,
        arguments: ((args as Record<string, unknown>) || {}) as Record<string, unknown>,
      });
    }

    throw new Error(`HTTP server ${serverName} is not connected`);
  }

  async listTools(serverName: string): Promise<MCPTool[]> {
    const serverState = this.servers.get(serverName);
    const config = this.config.get(serverName);
    if (resolveTransport(config || {}) === 'stdio' && serverState?.status === 'connected') {
      try {
        const response = await this.sendStdioRequest(serverName, 'tools/list', {}, 10000);
        const tools = this.extractToolsResponse(response);
        if (tools.length > 0) {
          this.registerTools(serverName, tools);
          return tools;
        }
      } catch (error) {
        console.warn(`[MCPClient] Failed to refresh stdio tools for ${serverName}:`, error);
      }
    }

    if (
      resolveTransport(config || {}) === 'streamable-http' &&
      serverState?.status === 'connected'
    ) {
      try {
        const tools = await this.listToolsFromHttpClient(serverName);
        this.registerTools(serverName, tools);
        return tools;
      } catch (error) {
        console.warn(`[MCPClient] Failed to refresh HTTP tools for ${serverName}:`, error);
      }
    }

    return serverState?.tools || [];
  }

  async getResource(serverName: string, uri: string): Promise<unknown> {
    const config = this.config.get(serverName);
    if (resolveTransport(config || {}) === 'stdio') {
      return this.sendStdioRequest(serverName, 'resources/get', { uri }, 15000);
    }
    if (resolveTransport(config || {}) !== 'streamable-http' || !config?.url) {
      throw new Error(`Server ${serverName} is not an HTTP server`);
    }

    const httpClient = this.httpClients.get(serverName);
    if (!httpClient) {
      throw new Error(`HTTP server ${serverName} is not connected`);
    }

    return httpClient.readResource({ uri });
  }

  getAllTools(): Map<string, MCPTool> {
    return this.allTools;
  }

  getServerState(serverName: string): MCPServerState | undefined {
    return this.servers.get(serverName);
  }

  listServers(): MCPServerState[] {
    return Array.from(this.servers.values()).map((server) => ({
      ...server,
      tools: [...server.tools],
    }));
  }
}

let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}

export function createMCPClient(): MCPClient {
  return new MCPClient();
}

export function resetMCPClient(): void {
  mcpClientInstance = null;
}
