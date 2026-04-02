import axios from 'axios';
import crypto from 'crypto';
export class FeishuBot {
    platform = 'feishu';
    config;
    messageHandler;
    tenantAccessToken = null;
    tokenExpireTime = 0;
    TOKEN_REFRESH_BEFORE;
    DEFAULT_TIMEOUT = 30000;
    axiosInstance;
    constructor(config) {
        this.config = config;
        this.TOKEN_REFRESH_BEFORE = config.tokenRefreshBefore ?? 300000;
        this.axiosInstance = axios.create({
            timeout: this.DEFAULT_TIMEOUT,
        });
    }
    async initialize() {
        await this.getTenantAccessToken();
        console.log('[FeishuBot] Initialized');
    }
    async getTenantAccessToken() {
        if (this.tenantAccessToken && Date.now() < this.tokenExpireTime - this.TOKEN_REFRESH_BEFORE) {
            return;
        }
        try {
            const response = await this.axiosInstance.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
                app_id: this.config.appId,
                app_secret: this.config.appSecret,
            });
            this.tenantAccessToken = response.data.tenant_access_token;
            this.tokenExpireTime = Date.now() + (response.data.expire - 60) * 1000;
            console.log('[FeishuBot] Token refreshed, expires at:', new Date(this.tokenExpireTime));
        }
        catch (error) {
            console.error('[FeishuBot] Failed to get tenant access token:', error);
            throw error;
        }
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    async handleCallback(payload) {
        const { type, event } = payload;
        if (type === 'url_verification') {
            return;
        }
        if (type === 'event_callback' && event?.type === 'im.message') {
            await this.handleMessageEvent(event);
        }
    }
    async handleMessageEvent(event) {
        if (!this.shouldProcessMessage(event))
            return;
        const message = this.parseMessage(event);
        if (this.messageHandler) {
            this.messageHandler(message);
        }
    }
    shouldProcessMessage(event) {
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
    isMentionedBot(event) {
        return (event.message?.mentions?.some((m) => m.sender_id?.user_id === this.config.appId) ?? false);
    }
    parseMessage(event) {
        let content = {};
        try {
            content = JSON.parse(event.message.content);
        }
        catch (err) {
            console.warn('[FeishuBot] Failed to parse message content:', err);
        }
        const text = content.text || '';
        return {
            id: event.message.message_id,
            platform: 'feishu',
            userId: event.sender.sender_id.user_id,
            content: text.replace(/@[^\s]+\s*/, '').trim(),
            type: event.message.msg_type,
            timestamp: event.message.create_time,
            conversationId: event.message.chat_id,
            msgType: event.message.msg_type,
            messageId: event.message.message_id,
            messageType: event.message.chat_id.startsWith('im_dm') ? 'direct' : 'group',
        };
    }
    async sendMessage(conversationId, message) {
        await this.ensureToken();
        const payload = typeof message === 'string'
            ? { msg_type: 'text', content: { text: message } }
            : this.buildCardMessage(message);
        await this.axiosInstance.post('https://open.feishu.cn/open-apis/im/v1/messages', payload, {
            params: { receive_id_type: 'chat_id' },
            headers: { Authorization: `Bearer ${this.tenantAccessToken}` },
        });
    }
    async ensureToken() {
        if (!this.tenantAccessToken || Date.now() >= this.tokenExpireTime - this.TOKEN_REFRESH_BEFORE) {
            await this.getTenantAccessToken();
        }
    }
    buildCardMessage(card) {
        const elements = [{ tag: 'div', text: { tag: 'plain_text', content: card.title } }];
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
    buildElement(el) {
        if (el.type === 'text') {
            return { tag: 'div', text: { tag: 'plain_text', content: el.content } };
        }
        if (el.type === 'image') {
            return { tag: 'img', image_url: el.imageUrl };
        }
        return { tag: 'divider' };
    }
    buildAction(action) {
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
    async pushNotification(userId, notification) {
        await this.ensureToken();
        const userOpenId = await this.getUserOpenId(userId);
        if (!userOpenId) {
            console.warn('[FeishuBot] User not found:', userId);
            return;
        }
        const card = {
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
    async getUserOpenId(userId) {
        await this.ensureToken();
        try {
            const response = await this.axiosInstance.get(`https://open.feishu.cn/open-apis/contact/v3/user_id_mapping?user_id=${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${this.tenantAccessToken}` } });
            return response.data.data?.open_id;
        }
        catch (error) {
            console.error('[FeishuBot] Failed to get user open_id:', error);
            return null;
        }
    }
    async bindUser(imUserId, desktopUserId) {
        const { getBindingStore } = await import('../store/bindingStore');
        const bindingStore = getBindingStore();
        bindingStore.set(imUserId, {
            imUserId,
            desktopUserId,
            imPlatform: 'feishu',
            boundAt: Date.now(),
        });
    }
    async getBinding(desktopUserId) {
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
    verifySignature(timestamp, signature) {
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
let feishuBotInstance = null;
export function getFeishuBot(config) {
    if (!feishuBotInstance && config) {
        feishuBotInstance = new FeishuBot(config);
    }
    if (!feishuBotInstance) {
        throw new Error('[FeishuBot] Not initialized. Provide config first.');
    }
    return feishuBotInstance;
}
export function createFeishuBot(config) {
    feishuBotInstance = new FeishuBot(config);
    return feishuBotInstance;
}
