import * as Lark from '@larksuiteoapi/node-sdk';
import { IMBot, IMMessage, IMCard, IMNotification, IMBinding } from '../types';

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  enabled?: boolean;
}

interface FeishuIMMessage extends IMMessage {
  chatType?: string;
  messageId?: string;
}

export class FeishuBot implements IMBot {
  platform: 'feishu' = 'feishu';
  private config: FeishuConfig;
  private wsClient?: Lark.WSClient;
  private client?: Lark.Client;
  private eventDispatcher?: Lark.EventDispatcher;
  private messageHandler?: (msg: IMMessage) => void;
  private processedEventIds = new Map<string, number>();
  private readonly EVENT_ID_TTL = 60000;
  private readonly MAX_EVENT_ID_CACHE = 10000;

  constructor(config: FeishuConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.client = new Lark.Client({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
    });

    this.eventDispatcher = new Lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: any) => {
        console.log('[FeishuBot] Received message:', JSON.stringify(data));
        await this.handleMessageEvent(data);
      },
    });

    this.wsClient = new Lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
    });

    this.wsClient.start({ eventDispatcher: this.eventDispatcher });
    console.log('[FeishuBot] WebSocket client started');
  }

  private async handleMessageEvent(data: any): Promise<void> {
    const eventId = data.event_id;

    if (this.processedEventIds.size > this.MAX_EVENT_ID_CACHE) {
      const now = Date.now();
      for (const [id, time] of this.processedEventIds) {
        if (now - time > this.EVENT_ID_TTL) {
          this.processedEventIds.delete(id);
        }
      }
    }

    if (eventId && this.processedEventIds.has(eventId)) {
      console.log('[FeishuBot] Duplicate event ignored:', eventId);
      return;
    }

    if (eventId) {
      this.processedEventIds.set(eventId, Date.now());
    }

    const { message } = data;

    const { content, message_type, chat_type, chat_id, message_id } = message;

    let text = '';
    try {
      if (message_type === 'text') {
        text = JSON.parse(content).text;
      } else {
        console.log('[FeishuBot] Unsupported message type:', message_type);
        return;
      }
    } catch (error) {
      console.error('[FeishuBot] Failed to parse message:', error);
      return;
    }

    if (this.messageHandler) {
      const imMessage: FeishuIMMessage = {
        id: message_id,
        platform: 'feishu',
        type: 'text',
        content: text,
        userId: data.sender?.sender_id?.open_id || data.sender?.sender_id?.union_id || '',
        timestamp: Date.now(),
        conversationId: chat_id,
        chatType: chat_type,
        messageId: message_id,
      };
      await this.messageHandler(imMessage);
    }
  }

  async sendMessage(
    conversationId: string,
    message: string | IMCard,
    chatType?: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error('[FeishuBot] Client not initialized');
    }

    const content =
      typeof message === 'string'
        ? JSON.stringify({ text: message })
        : JSON.stringify(this.buildCardMessage(message));

    const isPrivateChat = chatType === 'p2p';

    try {
      if (isPrivateChat) {
        // 私聊 (p2p): 使用 message.create 接口，传入 chat_id
        await this.client.im.v1.message.create({
          params: {
            receive_id_type: 'chat_id',
          },
          data: {
            receive_id: conversationId,
            content: content,
            msg_type: typeof message === 'string' ? 'text' : 'interactive',
          },
        });
      } else {
        // 群聊: 使用 message.reply 接口，传入 message_id (conversationId)
        await this.client.im.v1.message.reply({
          path: {
            message_id: conversationId,
          },
          data: {
            content: content,
            msg_type: typeof message === 'string' ? 'text' : 'interactive',
          },
        });
      }
    } catch (error) {
      console.error('[FeishuBot] Failed to send message:', error);
      throw error;
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
      config: { wide_screen_mode: true },
      elements,
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
    if (!this.client) {
      console.warn('[FeishuBot] Client not initialized');
      return;
    }

    try {
      const content = JSON.stringify({
        text: `📋 ${notification.title}\n\n${notification.content}`,
      });

      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'open_id',
        },
        data: {
          receive_id: userId,
          content: content,
          msg_type: 'text',
        },
      });

      console.log('[FeishuBot] Push notification success to', userId);
    } catch (error) {
      console.error('[FeishuBot] Push notification failed:', error);
    }
  }

  onMessage(handler: (msg: IMMessage) => void): void {
    this.messageHandler = handler;
  }

  async bindUser(imUserId: string, desktopUserId: string): Promise<void> {
    const { getBindingStore } = await import('../store/bindingStore.js');
    const bindingStore = getBindingStore();
    bindingStore.set(imUserId, {
      imUserId,
      desktopUserId,
      imPlatform: 'feishu',
      boundAt: Date.now(),
    });
  }

  async getBinding(desktopUserId: string): Promise<IMBinding | null> {
    const { getBindingStore } = await import('../store/bindingStore.js');
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
    return true;
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
