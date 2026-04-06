import * as fs from 'fs';
import * as path from 'path';

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  enabled?: boolean;
}

let cachedConfig: FeishuConfig | null = null;

export function loadFeishuConfig(): FeishuConfig | null {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(process.cwd(), 'config', 'feishu.json');

  if (!fs.existsSync(configPath)) {
    console.log('[Feishu] Config file not found, IM integration disabled');
    return null;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as FeishuConfig;

    if (!config.appId || !config.appSecret) {
      console.warn('[Feishu] appId or appSecret not configured');
      return null;
    }

    cachedConfig = config;
    console.log('[Feishu] Config loaded:', {
      appId: config.appId,
      enabled: config.enabled ?? true,
    });

    return config;
  } catch (error) {
    console.error('[Feishu] Failed to load config:', error);
    return null;
  }
}
