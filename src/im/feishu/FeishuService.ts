import { createFeishuBot, FeishuBot, FeishuConfig } from './FeishuBot';
import { createDispatchService, DispatchService } from '../DispatchService';
import { getProgressEmitter, ProgressEmitter } from '../ProgressEmitter';
import { initializeBindingStore } from '../store/bindingStore';
import { loadFeishuConfig } from './config';
import { getConnectionStatusManager } from '../../config/connectionStatusManager';

export interface FeishuServiceConfig {
  feishu: FeishuConfig;
  userDataPath: string;
}

export class FeishuService {
  private bot: FeishuBot | null = null;
  private dispatchService: DispatchService | null = null;
  private progressEmitter: ProgressEmitter | null = null;
  private config: FeishuServiceConfig | null = null;

  async initialize(config: FeishuServiceConfig): Promise<void> {
    console.log('[FeishuService] Initializing...');

    initializeBindingStore(config.userDataPath);

    this.config = config;
    this.bot = createFeishuBot({ ...config.feishu, storagePath: config.userDataPath });
    await this.bot.initialize();

    this.dispatchService = createDispatchService(this.bot);

    this.bot.onMessage(async (msg) => {
      console.log('[FeishuService] Received message:', msg.content);
      await this.dispatchService?.handleMessage(msg);
    });

    this.progressEmitter = getProgressEmitter();
    this.progressEmitter.setIMBot(this.bot);

    console.log('[FeishuService] Initialized successfully');
  }

  async reload(): Promise<void> {
    console.log('[FeishuService] Reloading...');

    this.bot = null;
    this.dispatchService = null;

    const config = loadFeishuConfig();
    if (config && config.enabled !== false && this.config) {
      this.bot = createFeishuBot({ ...config, storagePath: this.config.userDataPath });
      await this.bot.initialize();

      this.dispatchService = createDispatchService(this.bot);

      this.bot.onMessage(async (msg) => {
        console.log('[FeishuService] Received message:', msg.content);
        await this.dispatchService?.handleMessage(msg);
      });

      this.progressEmitter?.setIMBot(this.bot);
    }

    console.log('[FeishuService] Reload complete');
  }

  getBot(): FeishuBot | null {
    return this.bot;
  }

  getDispatchService(): DispatchService | null {
    return this.dispatchService;
  }

  getProgressEmitter(): ProgressEmitter | null {
    return this.progressEmitter;
  }

  async cleanup(): Promise<void> {
    const statusManager = getConnectionStatusManager();
    console.log('[FeishuService] Cleaning up...');

    if (this.bot) {
      try {
        await this.bot.close();
      } catch (error) {
        console.error('[FeishuService] Error closing bot:', error);
      }
      this.bot = null;
    }

    this.dispatchService = null;
    this.progressEmitter = null;
    this.config = null;

    statusManager.setStatus('feishu', 'disconnected');
    console.log('[FeishuService] Cleanup complete');
  }
}

let feishuServiceInstance: FeishuService | null = null;

export function getFeishuService(): FeishuService {
  if (!feishuServiceInstance) {
    feishuServiceInstance = new FeishuService();
  }
  return feishuServiceInstance;
}

export function createFeishuService(config: FeishuServiceConfig): FeishuService {
  feishuServiceInstance = new FeishuService();
  feishuServiceInstance.initialize(config).catch((err) => {
    console.error('[FeishuService] Initialize failed:', err);
  });
  return feishuServiceInstance;
}
