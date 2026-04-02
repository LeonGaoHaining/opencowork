import { createFeishuBot } from './FeishuBot';
import { createDispatchService } from '../DispatchService';
import { getProgressEmitter } from '../ProgressEmitter';
import { initializeBindingStore } from '../store/bindingStore';
export class FeishuService {
    bot = null;
    dispatchService = null;
    progressEmitter = null;
    async initialize(config) {
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
    async handleCallback(payload) {
        if (this.bot) {
            await this.bot.handleCallback(payload);
        }
    }
    getBot() {
        return this.bot;
    }
    getDispatchService() {
        return this.dispatchService;
    }
    getProgressEmitter() {
        return this.progressEmitter;
    }
}
let feishuServiceInstance = null;
export function getFeishuService() {
    if (!feishuServiceInstance) {
        feishuServiceInstance = new FeishuService();
    }
    return feishuServiceInstance;
}
export function createFeishuService(config) {
    feishuServiceInstance = new FeishuService();
    feishuServiceInstance.initialize(config).catch((err) => {
        console.error('[FeishuService] Initialize failed:', err);
    });
    return feishuServiceInstance;
}
