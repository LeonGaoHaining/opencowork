import * as fs from 'fs';
import * as path from 'path';
import {
  WhitelistConfig,
  DEFAULT_WHITELIST_CONFIG,
  validateWhitelistConfig,
  WhitelistValidationResult,
} from './whitelistConfig';

export class WhitelistConfigStore {
  private configPath: string;
  private config: WhitelistConfig | null = null;

  constructor(configPath: string = './config/whitelist.json') {
    this.configPath = configPath;
  }

  async load(): Promise<WhitelistConfig> {
    try {
      const absolutePath = path.resolve(this.configPath);
      if (fs.existsSync(absolutePath)) {
        const content = await fs.promises.readFile(absolutePath, 'utf-8');
        const parsed = JSON.parse(content) as WhitelistConfig;
        this.config = this.mergeWithDefaults(parsed);
        return this.config;
      }
    } catch (error) {
      console.error('[WhitelistConfigStore] Failed to load config:', error);
    }
    this.config = { ...DEFAULT_WHITELIST_CONFIG };
    return this.config;
  }

  async save(
    config: WhitelistConfig
  ): Promise<{ success: boolean; validation: WhitelistValidationResult }> {
    const validation = validateWhitelistConfig(config);
    if (!validation.valid) {
      return { success: false, validation };
    }

    try {
      const absolutePath = path.resolve(this.configPath);
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      await fs.promises.writeFile(absolutePath, JSON.stringify(config, null, 2), 'utf-8');
      this.config = config;
      return { success: true, validation };
    } catch (error) {
      console.error('[WhitelistConfigStore] Failed to save config:', error);
      return {
        success: false,
        validation: { valid: false, errors: [`Failed to save: ${error}`], warnings: [] },
      };
    }
  }

  async get(): Promise<WhitelistConfig> {
    if (this.config) {
      return this.config;
    }
    return this.load();
  }

  async reset(): Promise<WhitelistConfig> {
    this.config = { ...DEFAULT_WHITELIST_CONFIG };
    await this.save(this.config);
    return this.config;
  }

  async exportConfig(): Promise<string> {
    const config = await this.get();
    return JSON.stringify(config, null, 2);
  }

  async importConfig(
    configJson: string
  ): Promise<{ success: boolean; validation: WhitelistValidationResult }> {
    try {
      const config = JSON.parse(configJson) as WhitelistConfig;
      return this.save(config);
    } catch (error) {
      return {
        success: false,
        validation: { valid: false, errors: [`Invalid JSON: ${error}`], warnings: [] },
      };
    }
  }

  private mergeWithDefaults(config: Partial<WhitelistConfig>): WhitelistConfig {
    return {
      cli: {
        enabled: config.cli?.enabled ?? DEFAULT_WHITELIST_CONFIG.cli.enabled,
        commands: config.cli?.commands ?? DEFAULT_WHITELIST_CONFIG.cli.commands,
      },
      paths: {
        enabled: config.paths?.enabled ?? DEFAULT_WHITELIST_CONFIG.paths.enabled,
        entries: config.paths?.entries ?? DEFAULT_WHITELIST_CONFIG.paths.entries,
      },
      network: {
        enabled: config.network?.enabled ?? DEFAULT_WHITELIST_CONFIG.network.enabled,
        hosts: config.network?.hosts ?? DEFAULT_WHITELIST_CONFIG.network.hosts,
        blockedPorts: config.network?.blockedPorts ?? DEFAULT_WHITELIST_CONFIG.network.blockedPorts,
      },
      agents: {
        enabled: config.agents?.enabled ?? DEFAULT_WHITELIST_CONFIG.agents.enabled,
        tools: config.agents?.tools ?? DEFAULT_WHITELIST_CONFIG.agents.tools,
        maxStepsPerTask:
          config.agents?.maxStepsPerTask ?? DEFAULT_WHITELIST_CONFIG.agents.maxStepsPerTask,
      },
    };
  }
}

let whitelistConfigStoreInstance: WhitelistConfigStore | null = null;

export function getWhitelistConfigStore(configPath?: string): WhitelistConfigStore {
  if (!whitelistConfigStoreInstance) {
    whitelistConfigStoreInstance = new WhitelistConfigStore(configPath);
  }
  return whitelistConfigStoreInstance;
}

export function createWhitelistConfigStore(configPath?: string): WhitelistConfigStore {
  whitelistConfigStoreInstance = new WhitelistConfigStore(configPath);
  return whitelistConfigStoreInstance;
}
