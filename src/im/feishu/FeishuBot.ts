import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import {
  IMBot,
  IMMessage,
  IMConfig,
  IMCard,
  IMNotification,
  IMBinding,
  FeishuMessage,
  FeishuCallbackPayload,
  FeishuMessageEvent,
} from '../types';

export interface FeishuConfig extends IMConfig {
  webhookUrl?: string;
}

export class FeishuBot implements IMBot {
  platform: 'feishu' = 'feishu';
  private config: FeishuConfig;
  private messageHandler?: (msg: IMMessage) => void;
  private tenantAccessToken: string | null = null;
  private tokenExpireTime: number = 0;
  private readonly TOKEN_REFRESH_BEFORE = 300000;
  private readonly DEFAULT_TIMEOUT = 30000;
  private axiosInstance: AxiosInstance;

  constructor(config: FeishuConfig) {
    this.config = config;
    this.axiosInstance = axios.create({
      timeout: this.DEFAULT_TIMEOUT,
    });
  }

  async initialize(): Promise<void> {
    await this.getTenantAccessToken();
    console.log('[FeishuBot] Initialized');
  }

  private async getTenantAccessToken(): Promise<void> {
    if (this.tenantAccessToken && Date.now() < this.tokenExpireTime - this.TOKEN_REFRESH_BEFORE) {
      return;
    }

    try {
      const response = await this.axiosInstance.post(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
          app_id: this.config.appId,
          app_secret: this.config.appSecret,
        }
      );
      this.tenantAccessToken = response.data.tenant_access_token;
      this.tokenExpireTime = Date.now() + (response.data.expire - 60) * 1000;
      console.log('[FeishuBot] Token refreshed, expires at:', new Date(this.tokenExpireTime));
    } catch (error) {
      console.error('[FeishuBot] Failed to get tenant access token:', error);
      throw error;
    }
  }

  onMessage(handler: (msg: IMMessage) => void): void {
    this.messageHandler = handler;
  }

  async handleCallback(payload: FeishuCallbackPayload): Promise<void> {
    const { type, event } = payload;

    if (type === 'url_verification') {
      return;
    }

    if (type === 'event_callback' && event?.type === 'im.message') {
      await this.handleMessageEvent(event);
    }
  }

  private async handleMessageEvent(event: FeishuMessageEvent): Promise<void> {
    if (!this.shouldProcessMessage(event)) return;

    const message = this.parseMessage(event);
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }

  private shouldProcessMessage(event: FeishuMessageEvent): boolean {
    const isDirectChat = event.message.chat_id.startsWith('im_dm');
    const isGroupChat = event.message.chat_id.startsWith('im_') && !isDirectChat;

    if (isDirectChat) {
      return true;
    }

    if (isGroupChat) {
      return this.isMentionedBot(event);
    }

    return false;
  }

  private isMentionedBot(event: FeishuMessageEvent): boolean {
    return (
      event.message?.mentions?.some((m) => m.sender_id?.user_id === this.config.appId) ?? false
    );
  }

  private parseMessage(event: FeishuMessageEvent): FeishuMessage {
    let content: any = {};
    try {
      content = JSON.parse(event.message.content);
    } catch (err) {
      console.warn('[FeishuBot] Failed to parse message content:', err);
    }
    const text = content.text || '';

    return {
      id: event.message.message_id,
      platform: 'feishu',
      userId: event.sender.sender_id.user_id,
      content: text.replace(/@[^\s]+\s*/, '').trim(),
      type: event.message.msg_type as 'text' | 'image' | 'file',
      timestamp: event.message.create_time,
      conversationId: event.message.chat_id,
      msgType: event.message.msg_type as 'text' | 'image' | 'rich_text',
      messageId: event.message.message_id,
      messageType: event.message.chat_id.startsWith('im_dm') ? 'direct' : 'group',
    };
  }

  async sendMessage(conversationId: string, message: string | IMCard): Promise<void> {
    await this.ensureToken();

    const payload =
      typeof message === 'string'
        ? { msg_type: 'text', content: { text: message } }
        : this.buildCardMessage(message);

    await this.axiosInstance.post('https://open.feishu.cn/open-apis/im/v1/messages', payload, {
      params: { receive_id_type: 'chat_id' },
      headers: { Authorization: `Bearer ${this.tenantAccessToken}` },
    });
  }

  private async ensureToken(): Promise<void> {
    if (!this.tenantAccessToken || Date.now() >= this.tokenExpireTime - this.TOKEN_REFRESH_BEFORE) {
      await this.getTenantAccessToken();
    }
  }

  private buildCardMessage(card: IMCard): object {
    const elements: object[] = [{ tag: 'div', text: { tag: 'plain_text', content: card.title } }];

    if (card.elements) {
      elements.push(...card.elements.map((el) => this.buildElement(el)));
    }

    if (card.actions && card.actions.length > 0) {
      elements.push({
        tag: 'action',
        actions: card.actions.map((action) => this.buildAction(action)),
      });
    }

    return {
      msg_type: 'interactive',
      content: JSON.stringify({
        config: { wide_screen_mode: true },
        elements,
      }),
    };
  }

  private buildElement(el: { type: string; content?: string; imageUrl?: string }): object {
    if (el.type === 'text') {
      return { tag: 'div', text: { tag: 'plain_text', content: el.content } };
    }
    if (el.type === 'image') {
      return { tag: 'img', image_url: el.imageUrl };
    }
    return { tag: 'divider' };
  }

  private buildAction(action: {
    type: string;
    text: string;
    value: string;
    actionType: string;
  }): object {
    if (action.actionType === 'url') {
      return {
        tag: 'button',
        text: { tag: 'plain_text', content: action.text },
        url: action.value,
        type: 'primary',
      };
    }
    return {
      tag: 'button',
      text: { tag: 'plain_text', content: action.text },
      value: action.value,
      type: 'primary',
    };
  }

  async pushNotification(userId: string, notification: IMNotification): Promise<void> {
    await this.ensureToken();

    const userOpenId = await this.getUserOpenId(userId);
    if (!userOpenId) {
      console.warn('[FeishuBot] User not found:', userId);
      return;
    }

    const card: IMCard = {
      title: notification.title,
      elements: [{ type: 'text', content: notification.content }],
    };

    if (notification.extra) {
      card.elements.push({ type: 'divider' });
      if (notification.extra.taskId) {
        card.elements.push({ type: 'text', content: `任务ID: ${notification.extra.taskId}` });
      }
      if (notification.extra.resultUrl) {
        card.actions = [
          {
            type: 'button',
            text: '查看结果',
            value: notification.extra.resultUrl,
            actionType: 'url',
          },
        ];
      }
    }

    await this.sendMessage(userOpenId, card);
  }

  private async getUserOpenId(userId: string): Promise<string | null> {
    await this.ensureToken();

    try {
      const response = await this.axiosInstance.get(
        `https://open.feishu.cn/open-apis/contact/v3/user_id_mapping?user_id=${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${this.tenantAccessToken}` } }
      );
      return response.data.data?.open_id;
    } catch (error) {
      console.error('[FeishuBot] Failed to get user open_id:', error);
      return null;
    }
  }

  async bindUser(imUserId: string, desktopUserId: string): Promise<void> {
    const { getBindingStore } = await import('../store/bindingStore');
    const bindingStore = getBindingStore();
    bindingStore.set(imUserId, {
      imUserId,
      desktopUserId,
      imPlatform: 'feishu',
      boundAt: Date.now(),
    });
  }

  async getBinding(desktopUserId: string): Promise<IMBinding | null> {
    const { getBindingStore } = await import('../store/bindingStore');
    const bindingStore = getBindingStore();
    const binding = bindingStore.getByDesktopUserId(desktopUserId);
    if (binding) {
      return {
        imUserId: binding.imUserId,
        desktopUserId: binding.desktopUserId,
        boundAt: binding.boundAt,
      };
    }
    return null;
  }

  verifySignature(timestamp: string, signature: string): boolean {
    if (!this.config.encryptKey) {
      console.warn('[FeishuBot] encryptKey not configured, skipping verification');
      return true;
    }

    const expected = crypto
      .createHmac('sha256', this.config.encryptKey)
      .update(timestamp)
      .digest('hex');

    return expected === signature;
  }
}

let feishuBotInstance: FeishuBot | null = null;

export function getFeishuBot(config?: FeishuConfig): FeishuBot {
  if (!feishuBotInstance && config) {
    feishuBotInstance = new FeishuBot(config);
  }
  if (!feishuBotInstance) {
    throw new Error('[FeishuBot] Not initialized. Provide config first.');
  }
  return feishuBotInstance;
}

export function createFeishuBot(config: FeishuConfig): FeishuBot {
  feishuBotInstance = new FeishuBot(config);
  return feishuBotInstance;
}
