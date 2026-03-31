import { createFeishuBot, FeishuBot, FeishuConfig } from './FeishuBot';
import { createDispatchService, DispatchService } from '../DispatchService';
import { getProgressEmitter, ProgressEmitter } from '../ProgressEmitter';
import { initializeBindingStore } from '../store/bindingStore';
import { FeishuCallbackPayload } from '../types';

export interface FeishuServiceConfig {
  feishu: FeishuConfig;
  userDataPath: string;
}

export class FeishuService {
  private bot: FeishuBot | null = null;
  private dispatchService: DispatchService | null = null;
  private progressEmitter: ProgressEmitter | null = null;

  async initialize(config: FeishuServiceConfig): Promise<void> {
    console.log('[FeishuService] Initializing...');

    initializeBindingStore(config.userDataPath);

    this.bot = createFeishuBot(config.feishu);
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

  async handleCallback(payload: FeishuCallbackPayload): Promise<void> {
    if (this.bot) {
      await this.bot.handleCallback(payload);
    }
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
