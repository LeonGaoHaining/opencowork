import * as fs from 'fs';
import * as path from 'path';

export type IMPlatform = 'feishu' | 'dingtalk' | 'wecom' | 'slack';
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface FeishuConfig {
  enabled: boolean;
  appId: string;
  appSecret: string;
}

export interface DingTalkConfig {
  enabled: boolean;
  appKey: string;
  appSecret: string;
}

export interface WeComConfig {
  enabled: boolean;
  corpId: string;
  agentId: string;
  corpSecret: string;
}

export interface SlackConfig {
  enabled: boolean;
  botToken: string;
  signingSecret: string;
}

export type IMPlatformConfig = FeishuConfig | DingTalkConfig | WeComConfig | SlackConfig;

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

const DEFAULT_FEISHU_CONFIG: FeishuConfig = {
  enabled: false,
  appId: '',
  appSecret: '',
};

const DEFAULT_DINGTALK_CONFIG: DingTalkConfig = {
  enabled: false,
  appKey: '',
  appSecret: '',
};

const DEFAULT_WECOM_CONFIG: WeComConfig = {
  enabled: false,
  corpId: '',
  agentId: '',
  corpSecret: '',
};

const DEFAULT_SLACK_CONFIG: SlackConfig = {
  enabled: false,
  botToken: '',
  signingSecret: '',
};

export class IMConfigStore {
  private configs: Record<IMPlatform, IMPlatformConfig> = {
    feishu: DEFAULT_FEISHU_CONFIG,
    dingtalk: DEFAULT_DINGTALK_CONFIG,
    wecom: DEFAULT_WECOM_CONFIG,
    slack: DEFAULT_SLACK_CONFIG,
  };
  private configDir: string;

  constructor(configDir: string = './config') {
    this.configDir = configDir;
  }

  async loadAll(): Promise<Record<IMPlatform, IMPlatformConfig>> {
    const platforms: IMPlatform[] = ['feishu', 'dingtalk', 'wecom', 'slack'];

    for (const platform of platforms) {
      try {
        const configPath = path.resolve(this.configDir, `${platform}.json`);
        if (fs.existsSync(configPath)) {
          const content = await fs.promises.readFile(configPath, 'utf-8');
          const parsed = JSON.parse(content) as IMPlatformConfig;
          this.configs[platform] = parsed;
        }
      } catch (error) {
        console.error(`[IMConfigStore] Failed to load ${platform} config:`, error);
      }
    }

    return this.configs;
  }

  async save(
    platform: IMPlatform,
    config: IMPlatformConfig
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const validation = this.validate(platform, config);
      if (!validation.valid) {
        return { success: false, error: validation.errors?.join(', ') };
      }

      const configPath = path.resolve(this.configDir, `${platform}.json`);

      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      this.configs[platform] = config;

      return { success: true };
    } catch (error: any) {
      console.error(`[IMConfigStore] Failed to save ${platform} config:`, error);
      return { success: false, error: error.message };
    }
  }

  validate(platform: IMPlatform, config: IMPlatformConfig): ValidationResult {
    const errors: string[] = [];

    switch (platform) {
      case 'feishu': {
        const feishuConfig = config as FeishuConfig;
        if (feishuConfig.enabled) {
          if (!feishuConfig.appId || !feishuConfig.appId.startsWith('cli_')) {
            errors.push('飞书 App ID 必须以 cli_ 开头');
          }
          if (!feishuConfig.appSecret) {
            errors.push('飞书 App Secret 不能为空');
          }
        }
        break;
      }
      case 'dingtalk': {
        const dingtalkConfig = config as DingTalkConfig;
        if (dingtalkConfig.enabled) {
          if (!dingtalkConfig.appKey) {
            errors.push('钉钉 App Key 不能为空');
          }
          if (!dingtalkConfig.appSecret) {
            errors.push('钉钉 App Secret 不能为空');
          }
        }
        break;
      }
      case 'wecom': {
        const wecomConfig = config as WeComConfig;
        if (wecomConfig.enabled) {
          if (!wecomConfig.corpId) {
            errors.push('企业微信 Corp ID 不能为空');
          }
          if (!wecomConfig.agentId) {
            errors.push('企业微信 Agent ID 不能为空');
          }
          if (!wecomConfig.corpSecret) {
            errors.push('企业微信 Corp Secret 不能为空');
          }
        }
        break;
      }
      case 'slack': {
        const slackConfig = config as SlackConfig;
        if (slackConfig.enabled) {
          if (!slackConfig.botToken || !slackConfig.botToken.startsWith('xoxb-')) {
            errors.push('Slack Bot Token 必须以 xoxb- 开头');
          }
          if (!slackConfig.signingSecret) {
            errors.push('Slack Signing Secret 不能为空');
          }
        }
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getStatus(platform: IMPlatform): ConnectionStatus {
    const config = this.configs[platform];
    if (!config || !(config as any).enabled) {
      return 'disconnected';
    }
    return 'connected';
  }

  getConfigs(): Record<IMPlatform, IMPlatformConfig> {
    return this.configs;
  }

  getConfig(platform: IMPlatform): IMPlatformConfig {
    return this.configs[platform];
  }
}

let imConfigStoreInstance: IMConfigStore | null = null;

export function getIMConfigStore(): IMConfigStore {
  if (!imConfigStoreInstance) {
    imConfigStoreInstance = new IMConfigStore('./config');
  }
  return imConfigStoreInstance;
}
