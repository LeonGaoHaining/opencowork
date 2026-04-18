import * as fs from 'fs';
import * as path from 'path';
import type { MCPServerConfig } from './mcpClient';

export interface MCPSamplingConfig {
  enabled: boolean;
  defaultModel?: string;
  timeout: number;
  maxToolRounds: number;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface MCPServerModeConfig {
  enabled: boolean;
  port: number;
  auth?: {
    type: 'bearer';
    token: string;
  };
}

export interface MCPConfigFile {
  servers: Record<string, MCPServerConfig>;
  sampling: MCPSamplingConfig;
  server: MCPServerModeConfig;
}

const DEFAULT_MCP_CONFIG: MCPConfigFile = {
  servers: {},
  sampling: {
    enabled: true,
    defaultModel: '',
    timeout: 120,
    maxToolRounds: 10,
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
    },
  },
  server: {
    enabled: false,
    port: 3100,
  },
};

function normalizeServerConfig(config: MCPServerConfig | undefined): MCPServerConfig {
  if (!config) {
    return {};
  }

  if (config.transport === 'stdio' || config.transport === 'streamable-http') {
    return config;
  }

  if (config.command) {
    return {
      ...config,
      transport: 'stdio',
    };
  }

  if (config.url) {
    return {
      ...config,
      transport: 'streamable-http',
    };
  }

  return config;
}

function mergeConfig(partial: Partial<MCPConfigFile>): MCPConfigFile {
  const normalizedServers = Object.fromEntries(
    Object.entries(partial.servers || {}).map(([name, config]) => [
      name,
      normalizeServerConfig(config),
    ])
  );

  return {
    servers: normalizedServers,
    sampling: {
      ...DEFAULT_MCP_CONFIG.sampling,
      ...(partial.sampling || {}),
      rateLimit: {
        ...DEFAULT_MCP_CONFIG.sampling.rateLimit,
        ...(partial.sampling?.rateLimit || {}),
      },
    },
    server: {
      ...DEFAULT_MCP_CONFIG.server,
      ...(partial.server || {}),
    },
  };
}

export function getMCPConfigPath(): string {
  return path.join(process.cwd(), 'config', 'mcp.json');
}

export function loadMCPConfig(): MCPConfigFile {
  const configPath = getMCPConfigPath();
  if (!fs.existsSync(configPath)) {
    return DEFAULT_MCP_CONFIG;
  }

  try {
    return mergeConfig(JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<MCPConfigFile>);
  } catch (error) {
    console.error('[MCPConfig] Failed to load MCP config:', error);
    return DEFAULT_MCP_CONFIG;
  }
}

export function saveMCPConfig(config: MCPConfigFile): void {
  const configPath = getMCPConfigPath();
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const normalizedConfig: MCPConfigFile = {
    ...config,
    servers: Object.fromEntries(
      Object.entries(config.servers).map(([name, serverConfig]) => [
        name,
        normalizeServerConfig(serverConfig),
      ])
    ),
  };

  fs.writeFileSync(configPath, JSON.stringify(normalizedConfig, null, 2), 'utf-8');
}
