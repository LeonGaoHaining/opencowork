export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CLICommandWhitelist {
  command: string;
  allowed: boolean;
  args?: string[];
  description?: string;
  riskLevel: RiskLevel;
}

export interface PathPermissions {
  read: boolean;
  write: boolean;
  execute: boolean;
}

export interface PathWhitelist {
  path: string;
  allowed: boolean;
  permissions: PathPermissions;
  description?: string;
}

export interface AgentWhitelist {
  toolName: string;
  allowed: boolean;
  maxCallsPerTask?: number;
  description?: string;
}

export interface NetworkWhitelist {
  host: string;
  allowed: boolean;
  ports?: number[];
  description?: string;
}

export interface WhitelistConfig {
  cli: {
    enabled: boolean;
    commands: CLICommandWhitelist[];
  };
  paths: {
    enabled: boolean;
    entries: PathWhitelist[];
  };
  network: {
    enabled: boolean;
    hosts: NetworkWhitelist[];
    blockedPorts: number[];
  };
  agents: {
    enabled: boolean;
    tools: AgentWhitelist[];
    maxStepsPerTask?: number;
  };
}

export interface WhitelistValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const DEFAULT_WHITELIST_CONFIG: WhitelistConfig = {
  cli: {
    enabled: true,
    commands: [
      {
        command: 'git',
        allowed: true,
        args: ['status', 'pull', 'push', 'clone', 'log', 'diff'],
        riskLevel: 'low',
      },
      {
        command: 'npm',
        allowed: true,
        args: ['install', 'run', 'test', 'start', 'build'],
        riskLevel: 'medium',
      },
      { command: 'python', allowed: true, args: ['-c', '-m'], riskLevel: 'medium' },
      { command: 'node', allowed: true, args: [], riskLevel: 'medium' },
      {
        command: 'curl',
        allowed: true,
        args: ['-X GET', '-H', '-d', '--max-time'],
        riskLevel: 'medium',
      },
      { command: 'ls', allowed: true, args: ['-la', '-l', '-a'], riskLevel: 'low' },
      { command: 'pwd', allowed: true, args: [], riskLevel: 'low' },
      { command: 'echo', allowed: true, args: ['*'], riskLevel: 'low' },
    ],
  },
  paths: {
    enabled: true,
    entries: [
      {
        path: '~/Documents',
        allowed: true,
        permissions: { read: true, write: true, execute: false },
      },
      {
        path: '~/Downloads',
        allowed: true,
        permissions: { read: true, write: true, execute: false },
      },
      { path: '/tmp', allowed: true, permissions: { read: true, write: true, execute: false } },
      { path: '/usr/bin', allowed: true, permissions: { read: true, write: false, execute: true } },
    ],
  },
  network: {
    enabled: true,
    hosts: [
      { host: 'api.github.com', allowed: true },
      { host: 'api.openai.com', allowed: true },
      { host: '*.npmjs.com', allowed: true },
    ],
    blockedPorts: [22, 3389, 3306, 5432],
  },
  agents: {
    enabled: true,
    tools: [
      { toolName: 'browser:navigate', allowed: true },
      { toolName: 'browser:click', allowed: true },
      { toolName: 'browser:fill', allowed: true },
      { toolName: 'cli:execute', allowed: true },
      { toolName: 'file:read', allowed: true },
      { toolName: 'file:write', allowed: false, description: 'Disabled for safety' },
    ],
    maxStepsPerTask: 100,
  },
};

export function validateWhitelistConfig(config: WhitelistConfig): WhitelistValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.cli.enabled) {
    config.cli.commands.forEach((cmd) => {
      if (!cmd.command) {
        errors.push('CLI command name is required');
      }
      if (cmd.riskLevel === 'critical' && cmd.allowed) {
        warnings.push(`Critical risk command "${cmd.command}" is allowed`);
      }
    });
  }

  if (config.paths.enabled) {
    config.paths.entries.forEach((entry) => {
      if (!entry.path) {
        errors.push('Path entry path is required');
      }
      if (!entry.permissions.read && !entry.permissions.write && !entry.permissions.execute) {
        warnings.push(`Path "${entry.path}" has no permissions`);
      }
    });
  }

  if (config.agents.enabled) {
    config.agents.tools.forEach((tool) => {
      if (!tool.toolName) {
        errors.push('Agent tool name is required');
      }
    });
    if (config.agents.maxStepsPerTask && config.agents.maxStepsPerTask > 1000) {
      warnings.push('maxStepsPerTask is very high, consider lowering it');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function isRiskLevel(riskLevel: string): riskLevel is RiskLevel {
  return ['low', 'medium', 'high', 'critical'].includes(riskLevel);
}

export function getRiskLevelColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case 'low':
      return 'text-green-400';
    case 'medium':
      return 'text-yellow-400';
    case 'high':
      return 'text-orange-400';
    case 'critical':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}
