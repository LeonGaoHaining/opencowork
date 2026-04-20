import * as Lark from '@larksuiteoapi/node-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { IMAttachment, IMBot, IMMessage, IMCard, IMNotification, IMBinding } from '../types';
import { getConnectionStatusManager, IMPlatform } from '../../config/connectionStatusManager';

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  enabled?: boolean;
  storagePath?: string;
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
  private readonly storagePath: string;

  constructor(config: FeishuConfig) {
    this.config = config;
    this.storagePath = config.storagePath || path.join(process.cwd(), 'data');
  }

  async initialize(): Promise<void> {
    const statusManager = getConnectionStatusManager();

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

    try {
      await this.wsClient.start({ eventDispatcher: this.eventDispatcher });
      statusManager.setStatus('feishu', 'connected');
      console.log('[FeishuBot] WebSocket client started');
    } catch (error) {
      statusManager.setStatus('feishu', 'error');
      console.error('[FeishuBot] WebSocket start failed:', error);
      throw error;
    }
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
    const parsedContent = this.parseMessageContent(content);

    let text = '';
    let attachments: IMAttachment[] | undefined;
    try {
      if (message_type === 'text') {
        text = typeof parsedContent.text === 'string' ? parsedContent.text : '';
      } else if (message_type === 'file' || message_type === 'image') {
        const attachment = await this.downloadMessageAttachment(message_id, message_type, parsedContent);
        if (!attachment) {
          console.warn('[FeishuBot] Failed to download attachment for message:', message_id);
          return;
        }
        attachments = [attachment];
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
        type: message_type === 'image' ? 'image' : message_type === 'file' ? 'file' : 'text',
        content: text,
        userId: data.sender?.sender_id?.open_id || data.sender?.sender_id?.union_id || '',
        timestamp: Date.now(),
        conversationId: chat_id,
        chatType: chat_type,
        messageId: message_id,
        attachments,
      };
      await this.messageHandler(imMessage);
    }
  }

  private parseMessageContent(content: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.error('[FeishuBot] Failed to parse message content:', error);
      return {};
    }
  }

  private async downloadMessageAttachment(
    messageId: string,
    messageType: 'file' | 'image',
    parsedContent: Record<string, unknown>
  ): Promise<IMAttachment | null> {
    if (!this.client) {
      throw new Error('[FeishuBot] Client not initialized');
    }

    const fileKey =
      typeof parsedContent.file_key === 'string'
        ? parsedContent.file_key
        : typeof parsedContent.image_key === 'string'
          ? parsedContent.image_key
          : undefined;

    if (!fileKey) {
      console.warn('[FeishuBot] Missing file key in message content:', parsedContent);
      return null;
    }

    const resourceType = messageType === 'image' ? 'image' : 'file';
    const resource = await this.client.im.v1.messageResource.get({
      path: {
        message_id: messageId,
        file_key: fileKey,
      },
      params: {
        type: resourceType,
      },
    });

    const headers = resource.headers || {};
    const mimeType = this.getHeaderValue(headers, 'content-type');
    const originalName =
      (typeof parsedContent.file_name === 'string' ? parsedContent.file_name : undefined) ||
      this.getFilenameFromHeaders(headers) ||
      `${fileKey}${this.getExtensionFromMimeType(mimeType)}`;
    const safeName = this.sanitizeFileName(originalName);
    const targetDir = path.join(this.storagePath, 'im', 'feishu', 'inbox');
    await fs.promises.mkdir(targetDir, { recursive: true });

    const localPath = path.join(targetDir, `${Date.now()}-${safeName}`);
    await resource.writeFile(localPath);

    const stats = await fs.promises.stat(localPath);
    return {
      type: messageType,
      fileKey,
      fileName: safeName,
      mimeType,
      size: stats.size,
      localPath,
      messageId,
    };
  }

  private getHeaderValue(headers: Record<string, unknown>, key: string): string | undefined {
    const entry = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
    if (Array.isArray(entry)) {
      return typeof entry[0] === 'string' ? entry[0] : undefined;
    }
    return typeof entry === 'string' ? entry : undefined;
  }

  private getFilenameFromHeaders(headers: Record<string, unknown>): string | undefined {
    const disposition = this.getHeaderValue(headers, 'content-disposition');
    if (!disposition) {
      return undefined;
    }

    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const match = disposition.match(/filename="?([^";]+)"?/i);
    return match?.[1];
  }

  private getExtensionFromMimeType(mimeType?: string): string {
    if (!mimeType) {
      return '';
    }

    const normalized = mimeType.split(';')[0].trim().toLowerCase();
    const extensionMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/json': '.json',
      'application/zip': '.zip',
    };
    return extensionMap[normalized] || '';
  }

  private sanitizeFileName(fileName: string): string {
    const normalized = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    return normalized || 'attachment';
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
      await this.sendRawMessage(
        conversationId,
        typeof message === 'string' ? 'text' : 'interactive',
        content,
        isPrivateChat ? 'p2p' : chatType
      );
    } catch (error) {
      console.error('[FeishuBot] Failed to send message:', error);
      throw error;
    }
  }

  async sendAttachment(
    conversationId: string,
    attachment: IMAttachment,
    chatType?: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error('[FeishuBot] Client not initialized');
    }
    if (!attachment.localPath) {
      throw new Error('[FeishuBot] Attachment localPath is required');
    }

    const stats = await fs.promises.stat(attachment.localPath);
    if (!stats.isFile() || stats.size === 0) {
      throw new Error(`[FeishuBot] Attachment is not a readable file: ${attachment.localPath}`);
    }

    const isImageAttachment = attachment.type === 'image';
    if (isImageAttachment && stats.size > 10 * 1024 * 1024) {
      throw new Error('[FeishuBot] Image exceeds Feishu 10MB limit');
    }
    if (!isImageAttachment && stats.size > 30 * 1024 * 1024) {
      throw new Error('[FeishuBot] File exceeds Feishu 30MB limit');
    }

    if (isImageAttachment) {
      const uploaded = await this.client.im.v1.image.create({
        data: {
          image_type: 'message',
          image: fs.createReadStream(attachment.localPath),
        },
      });

      if (!uploaded?.image_key) {
        throw new Error('[FeishuBot] Feishu image upload returned no image_key');
      }

      await this.sendRawMessage(
        conversationId,
        'image',
        JSON.stringify({ image_key: uploaded.image_key }),
        chatType
      );
      return;
    }

    const uploaded = await this.client.im.v1.file.create({
      data: {
        file_type: this.getFeishuFileType(attachment.fileName),
        file_name: attachment.fileName || path.basename(attachment.localPath),
        file: fs.createReadStream(attachment.localPath),
      },
    });

    if (!uploaded?.file_key) {
      throw new Error('[FeishuBot] Feishu file upload returned no file_key');
    }

    await this.sendRawMessage(
      conversationId,
      'file',
      JSON.stringify({ file_key: uploaded.file_key }),
      chatType
    );
  }

  private getFeishuFileType(fileName?: string): 'opus' | 'mp4' | 'pdf' | 'doc' | 'xls' | 'ppt' | 'stream' {
    const extension = (fileName ? path.extname(fileName) : '').toLowerCase();
    if (extension === '.opus') {
      return 'opus';
    }
    if (extension === '.mp4') {
      return 'mp4';
    }
    if (extension === '.pdf') {
      return 'pdf';
    }
    if (extension === '.doc' || extension === '.docx') {
      return 'doc';
    }
    if (extension === '.xls' || extension === '.xlsx' || extension === '.csv') {
      return 'xls';
    }
    if (extension === '.ppt' || extension === '.pptx') {
      return 'ppt';
    }
    return 'stream';
  }

  private async sendRawMessage(
    conversationId: string,
    msgType: string,
    content: string,
    chatType?: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error('[FeishuBot] Client not initialized');
    }

    if (chatType === 'p2p') {
      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: conversationId,
          content,
          msg_type: msgType,
        },
      });
      return;
    }

    await this.client.im.v1.message.reply({
      path: {
        message_id: conversationId,
      },
      data: {
        content,
        msg_type: msgType,
      },
    });
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

  async close(): Promise<void> {
    const statusManager = getConnectionStatusManager();
    try {
      // 飞书 SDK 的 WSClient 没有提供 stop/close 方法
      // 解除引用让 GC 回收，SDK 会在下次 ping 超时后自动断开
      this.wsClient = undefined;
      this.client = undefined;
      this.eventDispatcher = undefined;
      statusManager.setStatus('feishu', 'disconnected');
      console.log('[FeishuBot] Connection closed');
    } catch (error) {
      statusManager.setStatus('feishu', 'error');
      console.error('[FeishuBot] Error closing connection:', error);
    }
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
