# OpenCowork v0.7 技术规格说明书

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.7       |
| 更新日期 | 2026-03-31 |
| 状态     | 规划中     |
| 基于PRD  | v2.8       |
| 前置版本 | v0.6       |

---

## 目录

1. [版本目标](#1-版本目标)
2. [技术架构](#2-技术架构)
3. [核心模块设计](#3-核心模块设计)
   - [3.1 FeishuBot Service](#31-feishubot-service)
   - [3.2 Command Parser](#32-command-parser)
   - [3.3 DispatchService](#33-dispatchservice)
   - [3.4 ProgressEmitter](#34-progressemitter)
   - [3.5 IMConnector 抽象](#35-imconnector-抽象)
4. [文件结构](#4-文件结构)
   - [4.1 BindingStore 设计](#41-bindingstore-设计)
   - [4.2 SessionStateMachine 设计](#42-sessionstatemachine-设计)
   - [4.3 WebhookServer 设计](#43-webhookserver-设计)
5. [安全加固](#5-安全加固)
   - [5.1 消息频率限制](#51-消息频率限制)
   - [5.2 敏感操作二次确认](#52-敏感操作二次确认)
   - [5.3 配置安全](#53-配置安全)
6. [与 Scheduler 集成](#6-与-scheduler-集成)
   - [6.1 任务转发流程](#61-任务转发流程)
   - [6.2 复用 v0.6 TaskQueue](#62-复用-v06-taskqueue)
7. [实施计划](#7-实施计划)
8. [成功指标](#8-成功指标)

---

## 1. 版本目标

**目标**: 飞书机器人 + 多端协同

### 核心目标

| 目标           | 说明                             |
| -------------- | -------------------------------- |
| **飞书机器人** | 消息接收、任务转发、结果推送     |
| **状态查询**   | 任务状态、列表查询命令           |
| **进度推送**   | 执行过程中主动推送进度通知       |
| **接管控制**   | 手机发送指令接管/交还桌面任务    |
| **对话交互**   | 多轮对话状态机，支持复杂任务确认 |

### 版本功能

| 功能              | 周期       | 交付标准              |
| ----------------- | ---------- | --------------------- |
| **飞书机器人**    | Week 29-30 | 消息接收、基础回复    |
| **任务转发**      | Week 29-30 | 飞书消息→桌面端       |
| **结果推送**      | Week 31-32 | 企业消息订阅主动推送  |
| **状态查询**      | Week 31-32 | 状态/列表命令         |
| **进度推送**      | Week 33    | 执行进度通知          |
| **接管控制**      | Week 33-34 | 手机接管/交还桌面任务 |
| **对话式交互**    | Week 33-34 | 多轮对话状态机        |
| **飞书Connector** | Week 34-36 | 飞书消息读写/通知     |
| **基础Connector** | Week 34-36 | Slack/GitHub连接器    |
| **操作审计**      | Week 37-38 | 完整审计日志          |

### 与 v0.6 关系

| 组件        | v0.6 实现          | v0.7 增强                    |
| ----------- | ------------------ | ---------------------------- |
| 任务执行    | Scheduler触发执行  | 飞书触发执行 (复用TaskQueue) |
| 任务状态    | TaskHistory记录    | 飞书状态查询                 |
| 任务队列    | TaskQueue (内存)   | 飞书任务优先级转发           |
| Skill       | SkillLoader        | 飞书调用Skill                |
| IPC Handler | task:start/execute | 新增 feishu:handle           |

### 任务ID前缀规范

| 来源      | 前缀  | 示例                   |
| --------- | ----- | ---------------------- |
| Scheduled | `st_` | `st_1700000000_a1b2c3` |
| Queued    | `qt_` | `qt_1700000001_d4e5f6` |
| Feishu    | `ft_` | `ft_1700000002_g7h8i9` |

### 错误码定义

| 错误码                   | 说明                 | 可恢复 |
| ------------------------ | -------------------- | ------ |
| `FEISHU_AUTH_FAILED`     | 飞书认证失败         | 是     |
| `FEISHU_TOKEN_EXPIRED`   | token已过期          | 是     |
| `COMMAND_NOT_RECOGNIZED` | 命令无法识别         | 是     |
| `TASK_NOT_FOUND`         | 任务不存在           | 否     |
| `TASK_ALREADY_COMPLETED` | 任务已完成，无法操作 | 否     |
| `IPC_FORWARD_FAILED`     | 转发桌面端失败       | 是     |
| `BINDING_NOT_FOUND`      | 用户未绑定           | 是     |

---

## 2. 技术架构

### 2.1 技术选型

| 项目       | 选型         | 理由                       |
| ---------- | ------------ | -------------------------- |
| IM平台     | 飞书         | 对个人开发者开放，无需企业 |
| 消息接收   | Webhook      | 接收@消息事件              |
| 消息推送   | 企业消息订阅 | 主动推送通知到用户         |
| 消息格式   | 飞书卡片消息 | 富文本展示任务结果         |
| HTTP客户端 | axios        | HTTP请求，现有依赖         |

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     Feishu Robot Layer                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │  FeishuBot     │  │  MessageQueue  │  │  IMConnector  │  │
│  │  Service       │  │  (内存队列)    │  │  (抽象接口)   │  │
│  │  • 消息接收    │  │  • 任务排队    │  │  • 消息发送   │  │
│  │  • 命令解析    │  │  • 优先级      │  │  • 卡片构建   │  │
│  │  • 会话管理    │  │  • 重试        │  │  • 用户绑定   │  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬───────┘  │
│           │                       │                    │         │
│           ▼                       ▼                    ▼         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    DispatchService                          ││
│  │  • 任务转发 Desktop                                        ││
│  │  • 状态同步                                                ││
│  │  • 接管控制                                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Desktop TaskEngine                       ││
│  │  • TaskPlanner 任务分解                                    ││
│  │  • TaskExecutor 执行                                        ││
│  │  • BrowserExecutor/CLIExecutor                            ││
│  │  • ProgressEmitter 进度事件                                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 模块职责

| 模块            | 职责                                |
| --------------- | ----------------------------------- |
| FeishuBot       | 飞书消息接收、签名验证、命令解析    |
| MessageQueue    | 任务消息队列、优先级排序、异步处理  |
| IMConnector     | 统一IM接口（飞书/Slack/GitHub）     |
| DispatchService | 任务转发Desktop、状态同步、接管控制 |
| ProgressEmitter | 任务进度事件发布、订阅管理          |

### 2.4 IM抽象接口

为支持未来扩展（钉钉/企业微信），预留统一接口：

```typescript
type IMPlatform = 'feishu' | 'dingtalk' | 'wecom' | 'slack' | 'github';

interface IMMessage {
  id: string;
  platform: IMPlatform;
  userId: string;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: number;
  conversationId: string;
}

interface IMCard {
  title: string;
  elements: IMElement[];
  actions?: IMAction[];
}

interface IMElement {
  type: 'text' | 'image' | 'divider';
  content?: string;
  imageUrl?: string;
}

interface IMAction {
  type: 'button';
  text: string;
  value: string;
  actionType: 'callback' | 'url';
}

interface IMNotification {
  title: string;
  content: string;
  extra?: Record<string, any>;
}

interface IMBot {
  platform: IMPlatform;

  // 初始化
  initialize(config: IMConfig): Promise<void>;

  // 消息处理
  onMessage(handler: (msg: IMMessage) => void): void;

  // 发送消息
  sendMessage(conversationId: string, message: string | IMCard): Promise<void>;

  // 发送通知
  pushNotification(userId: string, notification: IMNotification): Promise<void>;

  // 用户绑定
  bindUser(imUserId: string, desktopUserId: string): Promise<void>;
  getBinding(desktopUserId: string): Promise<IMBinding | null>;

  // 验证
  verifySignature(timestamp: string, signature: string): boolean;
}

interface IMConfig {
  appId: string;
  appSecret: string;
  verificationToken?: string;
  encryptKey?: string;
}

interface IMBinding {
  imUserId: string;
  desktopUserId: string;
  boundAt: number;
}
```

---

## 3. 核心模块设计

### 3.1 FeishuBot Service

```typescript
// src/im/feishu/FeishuBot.ts

import { IMBot, IMMessage, IMConfig, IMCard, IMNotification } from '../IMBot';
import crypto from 'crypto';

interface FeishuConfig extends IMConfig {
  webhookUrl?: string;
}

interface FeishuMessage extends IMMessage {
  msgType: 'text' | 'image' | 'rich_text';
  messageId: string;
  messageType: 'direct' | 'group';
}

interface CommandResult {
  command: string;
  args: string[];
  taskId?: string;
}

export class FeishuBot implements IMBot {
  platform: 'feishu' = 'feishu';
  private config: FeishuConfig;
  private messageHandler?: (msg: IMMessage) => void;
  private tenantAccessToken: string | null = null;
  private tokenExpireTime: number = 0;
  private readonly TOKEN_REFRESH_BEFORE = 300000; // 提前5分钟刷新

  constructor(config: FeishuConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    await this.getTenantAccessToken();
  }

  private async getTenantAccessToken(): Promise<void> {
    // 检查是否需要刷新token
    if (this.tenantAccessToken && Date.now() < this.tokenExpireTime - this.TOKEN_REFRESH_BEFORE) {
      return;
    }

    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: this.config.appId,
        app_secret: this.config.appSecret,
      }
    );
    this.tenantAccessToken = response.data.tenant_access_token;
    this.tokenExpireTime = Date.now() + (response.data.expire - 60) * 1000;
    console.log('[FeishuBot] Token refreshed, expires at:', new Date(this.tokenExpireTime));
  }

  onMessage(handler: (msg: IMMessage) => void): void {
    this.messageHandler = handler;
  }

  async handleCallback(payload: FeishuCallbackPayload): Promise<void> {
    const { type, event } = payload;

    if (type === 'url_verification') {
      return this.handleURLVerification(payload);
    }

    if (type === 'event_callback' && event?.type === 'im.message') {
      await this.handleMessageEvent(event);
    }
  }

  private async handleMessageEvent(event: FeishuMessageEvent): Promise<void> {
    if (!this.isMentionedBot(event)) return;

    const message = this.parseMessage(event);
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }

  private isMentionedBot(event: FeishuMessageEvent): boolean {
    return (
      event.message?.mentions?.some((m) => m.sender_id?.user_id === this.config.appId) ?? false
    );
  }

  private parseMessage(event: FeishuMessageEvent): FeishuMessage {
    const content = JSON.parse(event.message.content);
    const text = content.text || '';

    return {
      id: event.message.message_id,
      platform: 'feishu',
      userId: event.sender.sender_id.user_id,
      content: text.replace(/@[^s]+\s*/, '').trim(),
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

    await axios.post('https://open.feishu.cn/open-apis/im/v1/messages', payload, {
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

  private buildElement(el: IMElement): object {
    if (el.type === 'text') {
      return { tag: 'div', text: { tag: 'plain_text', content: el.content } };
    }
    if (el.type === 'image') {
      return { tag: 'img', image_url: el.imageUrl };
    }
    return { tag: 'divider' };
  }

  private buildAction(action: IMAction): object {
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
      const response = await axios.get(
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
    const bindingStore = getBindingStore();
    bindingStore.set(imUserId, { imUserId, desktopUserId, boundAt: Date.now() });
  }

  async getBinding(desktopUserId: string): Promise<IMBinding | null> {
    const bindingStore = getBindingStore();
    for (const binding of bindingStore.values()) {
      if (binding.desktopUserId === desktopUserId) {
        return binding;
      }
    }
    return null;
  }

  verifySignature(timestamp: string, signature: string): boolean {
    if (!this.config.encryptKey) {
      console.warn('[FeishuBot] encryptKey not configured, skipping verification');
      return true;
    }

    const crypto = require('crypto');
    const signStr = timestamp + '\n' + this.config.encryptKey;
    const hmac = crypto.createHmac('sha256', signStr);
    const hash = hmac.update('').digest('hex');

    const expectedSignature = crypto.createHash('sha256').update(hash).digest('hex');
    return expectedSignature === signature;
  }
}

interface FeishuCallbackPayload {
  type: 'url_verification' | 'event_callback';
  token?: string;
  challenge?: string;
  event?: FeishuMessageEvent;
}

interface FeishuMessageEvent {
  type: 'im.message';
  message: {
    message_id: string;
    chat_id: string;
    msg_type: string;
    create_time: number;
    content: string;
    mentions?: Array<{ sender_id: { user_id: string } }>;
  };
  sender: {
    sender_id: { user_id: string };
  };
}
```

### 3.2 Command Parser

```typescript
// src/im/feishu/CommandParser.ts

interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

export class CommandParser {
  private static readonly COMMANDS = {
    TASK: '任务',
    STATUS: '状态',
    LIST: '列表',
    TAKEOVER: '接管',
    RETURN: '交还',
    CANCEL: '取消',
    HELP: '帮助',
  } as const;

  parse(content: string): ParsedCommand | null {
    const trimmed = content.trim();
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    if (cmd === CommandParser.COMMANDS.TASK) {
      return { command: 'task', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.STATUS) {
      return { command: 'status', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.LIST) {
      return { command: 'list', args: [], raw: content };
    }
    if (cmd === CommandParser.COMMANDS.TAKEOVER) {
      return { command: 'takeover', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.RETURN) {
      return { command: 'return', args: [], raw: content };
    }
    if (cmd === CommandParser.COMMANDS.CANCEL) {
      return { command: 'cancel', args, raw: content };
    }
    if (cmd === CommandParser.COMMANDS.HELP) {
      return { command: 'help', args: [], raw: content };
    }

    // 默认作为任务描述处理
    return { command: 'task', args: [trimmed], raw: content };
  }

  getHelp(): string {
    return `
📋 OpenCowork 命令帮助

• 任务 [描述] - 发送新任务
  例: @机器人 任务 帮我查下北京天气

• 状态 [任务ID] - 查询任务状态
  例: @机器人 状态 abc123

• 列表 - 查看最近任务
  例: @机器人 列表

• 接管 [任务ID] - 接管任务
  例: @机器人 接管 abc123

• 交还 - 交还控制给AI
  例: @机器人 交还

• 取消 [任务ID] - 取消任务
 例: @机器人 取消 abc123

• 帮助 - 显示帮助
  例: @机器人 帮助
`.trim();
  }
}
```

### 3.3 DispatchService

```typescript
// src/im/DispatchService.ts

import { EventEmitter } from 'events';
import { IMMessage, IMBot } from './IMBot';
import { getScheduler } from '../scheduler/scheduler';

interface DispatchTask {
  id: string;
  description: string;
  source: 'feishu' | 'desktop';
  priority: 'low' | 'normal' | 'high';
  userId: string;
  conversationId: string;
  createdAt: number;
}

interface TaskStatus {
  id: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  result?: any;
  updatedAt: number;
}

const PRIORITY_MAP = {
  low: 10,
  normal: 5,
  high: 1,
};

export class DispatchService extends EventEmitter {
  private bot: IMBot;
  private taskQueue: DispatchTask[] = [];
  private statusMap: Map<string, TaskStatus> = new Map();
  private isProcessing = false;

  constructor(bot: IMBot) {
    super();
    this.bot = bot;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('task:status', (taskId: string, status: Partial<TaskStatus>) => {
      this.updateTaskStatus(taskId, status);
    });
  }

  async handleMessage(msg: IMMessage): Promise<void> {
    console.log('[DispatchService] Handling message from:', msg.userId);

    const parser = new CommandParser();
    const cmd = parser.parse(msg.content);

    switch (cmd?.command) {
      case 'task':
        await this.handleTask(msg, cmd.args.join(' '));
        break;
      case 'status':
        await this.handleStatus(msg, cmd.args[0]);
        break;
      case 'list':
        await this.handleList(msg);
        break;
      case 'takeover':
        await this.handleTakeover(msg, cmd.args[0]);
        break;
      case 'return':
        await this.handleReturn(msg);
        break;
      case 'cancel':
        await this.handleCancel(msg, cmd.args[0]);
        break;
      case 'help':
        await this.handleHelp(msg);
        break;
      default:
        await this.handleHelp(msg);
    }
  }

  private async handleTask(msg: IMMessage, description: string): Promise<void> {
    if (!description) {
      await this.bot.sendMessage(msg.conversationId, '请输入任务描述');
      return;
    }

    const task: DispatchTask = {
      id: this.generateTaskId(),
      description,
      source: 'feishu',
      priority: 'normal',
      userId: msg.userId,
      conversationId: msg.conversationId,
      createdAt: Date.now(),
    };

    this.enqueueTask(task);
    this.statusMap.set(task.id, {
      id: task.id,
      status: 'pending',
      updatedAt: Date.now(),
    });

    await this.bot.sendMessage(
      msg.conversationId,
      `✅ 任务已接收\n\n任务ID: ${task.id}\n描述: ${description}`
    );

    await this.forwardToDesktop(task);
  }

  private enqueueTask(task: DispatchTask): void {
    const priority = PRIORITY_MAP[task.priority];
    const index = this.taskQueue.findIndex((t) => PRIORITY_MAP[t.priority] > priority);
    if (index === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(index, 0, task);
    }
    console.log('[DispatchService] Task enqueued:', task.id, 'Queue size:', this.taskQueue.length);
  }

  private async forwardToDesktop(task: DispatchTask): Promise<void> {
    try {
      const scheduler = getScheduler();
      const result = await scheduler.executeTask({
        name: task.id,
        description: task.description,
        type: 'one-time',
        schedule: null,
        enabled: true,
      });

      if (result.success) {
        this.updateTaskStatus(task.id, { status: 'completed', result: result });
      } else {
        this.updateTaskStatus(task.id, { status: 'failed', message: result.error?.message });
      }
    } catch (error) {
      console.error('[DispatchService] Forward to desktop failed:', error);
      this.updateTaskStatus(task.id, { status: 'failed', message: String(error) });
    }
  }

  private async handleStatus(msg: IMMessage, taskId?: string): Promise<void> {
    if (!taskId) {
      await this.bot.sendMessage(msg.conversationId, '请提供任务ID');
      return;
    }

    const status = this.statusMap.get(taskId);
    if (!status) {
      await this.bot.sendMessage(msg.conversationId, `任务 ${taskId} 不存在`);
      return;
    }

    const statusText = {
      pending: '⏳ 待执行',
      executing: '🔄 执行中',
      completed: '✅ 已完成',
      failed: '❌ 失败',
    }[status.status];

    await this.bot.sendMessage(
      msg.conversationId,
      `📋 任务状态\n\nID: ${taskId}\n状态: ${statusText}`
    );
  }

  private async handleList(msg: IMMessage): Promise<void> {
    const tasks = Array.from(this.statusMap.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);

    if (tasks.length === 0) {
      await this.bot.sendMessage(msg.conversationId, '暂无任务记录');
      return;
    }

    const list = tasks.map((t) => `${t.id.slice(0, 8)} - ${t.status}`).join('\n');

    await this.bot.sendMessage(msg.conversationId, `📋 最近任务\n\n${list}`);
  }

  private async handleTakeover(msg: IMMessage, taskId: string): Promise<void> {
    if (!taskId) {
      await this.bot.sendMessage(msg.conversationId, '请提供任务ID');
      return;
    }

    try {
      const ipcResult = await this.ipcInvoke('feishu:takeover', { taskId, userId: msg.userId });
      if (ipcResult.success) {
        await this.bot.sendMessage(msg.conversationId, `🔐 已接管任务\n\n任务ID: ${taskId}`);
      } else {
        await this.bot.sendMessage(msg.conversationId, `❌ 接管失败: ${ipcResult.error}`);
      }
    } catch (error) {
      console.error('[DispatchService] Takeover failed:', error);
      await this.bot.sendMessage(msg.conversationId, `❌ 接管失败: ${String(error)}`);
    }
  }

  private async handleReturn(msg: IMMessage): Promise<void> {
    try {
      const ipcResult = await this.ipcInvoke('feishu:return', { userId: msg.userId });
      if (ipcResult.success) {
        await this.bot.sendMessage(msg.conversationId, '🔄 已交还控制权给AI');
      } else {
        await this.bot.sendMessage(msg.conversationId, `❌ 交还失败: ${ipcResult.error}`);
      }
    } catch (error) {
      console.error('[DispatchService] Return failed:', error);
      await this.bot.sendMessage(msg.conversationId, `❌ 交还失败: ${String(error)}`);
    }
  }

  private async handleCancel(msg: IMMessage, taskId: string): Promise<void> {
    if (!taskId) {
      await this.bot.sendMessage(msg.conversationId, '请提供任务ID');
      return;
    }

    const status = this.statusMap.get(taskId);
    if (!status) {
      await this.bot.sendMessage(msg.conversationId, `任务 ${taskId} 不存在`);
      return;
    }

    if (status.status === 'completed') {
      await this.bot.sendMessage(msg.conversationId, `任务 ${taskId} 已完成，无法取消`);
      return;
    }

    try {
      const ipcResult = await this.ipcInvoke('feishu:cancel', { taskId });
      if (ipcResult.success) {
        this.updateTaskStatus(taskId, { status: 'failed', message: '用户取消' });
        await this.bot.sendMessage(msg.conversationId, `🗑️ 已取消任务\n\n任务ID: ${taskId}`);
      } else {
        await this.bot.sendMessage(msg.conversationId, `❌ 取消失败: ${ipcResult.error}`);
      }
    } catch (error) {
      console.error('[DispatchService] Cancel failed:', error);
      await this.bot.sendMessage(msg.conversationId, `❌ 取消失败: ${String(error)}`);
    }
  }

  private async ipcInvoke(
    channel: string,
    payload: any
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const { ipcRenderer } = require('electron');
      ipcRenderer
        .invoke(channel, payload)
        .then(resolve)
        .catch((err: Error) => resolve({ success: false, error: err.message }));
    });
  }

  private async handleHelp(msg: IMMessage): Promise<void> {
    const parser = new CommandParser();
    await this.bot.sendMessage(msg.conversationId, parser.getHelp());
  }

  updateTaskStatus(taskId: string, status: Partial<TaskStatus>): void {
    const existing = this.statusMap.get(taskId);
    if (existing) {
      this.statusMap.set(taskId, { ...existing, ...status, updatedAt: Date.now() });
      this.emit('task:status', taskId, status);
    }
  }

  getTaskStatus(taskId: string): TaskStatus | undefined {
    return this.statusMap.get(taskId);
  }

  private generateTaskId(): string {
    return `ft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

import { CommandParser } from './feishu/CommandParser';
```

### 3.3.1 IPC Handler Integration

新增以下 IPC handlers:

```typescript
// src/main/ipcHandlers.ts

export const IPC_HANDLERS: Record<string, IpcHandler> = {
  // ... existing handlers

  'feishu:handle': async (mainWindow, previewWindow, payload) => {
    const { getFeishuService } = await import('../im/feishu/FeishuService');
    const service = getFeishuService();
    return await service.handleCallback(payload);
  },

  'feishu:takeover': async (mainWindow, previewWindow, { taskId, userId }) => {
    const { getTaskEngine } = await import('../core/runtime/TaskEngine');
    const taskEngine = getTaskEngine();
    return await taskEngine.requestTakeover(taskId, userId);
  },

  'feishu:return': async (mainWindow, previewWindow, { userId }) => {
    const { getTaskEngine } = await import('../core/runtime/TaskEngine');
    const taskEngine = getTaskEngine();
    return await taskEngine.releaseControl(userId);
  },

  'feishu:cancel': async (mainWindow, previewWindow, { taskId }) => {
    const { getTaskEngine } = await import('../core/runtime/TaskEngine');
    const taskEngine = getTaskEngine();
    return await taskEngine.cancelTask(taskId);
  },

  'feishu:bind': async (mainWindow, previewWindow, { imUserId, desktopUserId }) => {
    const bindingStore = getBindingStore();
    bindingStore.set(imUserId, { imUserId, desktopUserId, boundAt: Date.now() });
    return { success: true };
  },
};
```

### 3.4 ProgressEmitter

```typescript
// src/im/ProgressEmitter.ts

type ProgressListener = (data: ProgressEvent) => void;

interface ProgressEvent {
  taskId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  step?: number;
  total?: number;
  message?: string;
  result?: any;
}

export class ProgressEmitter {
  private listeners: Map<string, Set<ProgressListener>> = new Map();
  private imBot: IMBot | null = null;

  setIMBot(bot: IMBot): void {
    this.imBot = bot;
  }

  subscribe(taskId: string, listener: ProgressListener): () => void {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, new Set());
    }
    this.listeners.get(taskId)!.add(listener);

    return () => {
      this.listeners.get(taskId)?.delete(listener);
    };
  }

  emit(event: ProgressEvent): void {
    const listeners = this.listeners.get(event.taskId);
    if (listeners) {
      listeners.forEach((listener) => listener(event));
    }

    // 推送飞书通知
    if (this.imBot && event.status !== 'pending') {
      this.pushToFeishu(event);
    }
  }

  private async pushToFeishu(event: ProgressEvent): Promise<void> {
    const statusText = {
      pending: '⏳ 待执行',
      executing: `🔄 执行中: ${event.message || ''}`,
      completed: '✅ 任务完成',
      failed: '❌ 任务失败',
    }[event.status];

    const message = `📋 ${event.taskId}\n${statusText}`;

    // 获取绑定的用户并推送
    // await this.imBot.pushNotification(userId, { title: event.taskId, content: message });
  }
}
```

### 3.5 IMConnector 抽象

```typescript
// src/im/connector/IMConnector.ts

import { IMBot, IMMessage, IMCard, IMNotification, IMPlatform } from '../IMBot';

export class IMConnector {
  private bots: Map<IMPlatform, IMBot> = new Map();

  registerBot(platform: IMPlatform, bot: IMBot): void {
    this.bots.set(platform, bot);
  }

  getBot(platform: IMPlatform): IMBot | undefined {
    return this.bots.get(platform);
  }

  async sendToPlatform(
    platform: IMPlatform,
    conversationId: string,
    message: string | IMCard
  ): Promise<void> {
    const bot = this.bots.get(platform);
    if (bot) {
      await bot.sendMessage(conversationId, message);
    }
  }

  async broadcastToAll(message: string | IMCard): Promise<void> {
    for (const bot of this.bots.values()) {
      // 需要conversationId，可以通过绑定关系查询
    }
  }
}
```

### 3.6 Slack/GitHub Connector (v1.0 预留)

```typescript
// src/im/connector/SlackBot.ts

import { IMBot, IMMessage, IMConfig, IMCard } from '../IMBot';

export class SlackBot implements IMBot {
  platform: 'slack' = 'slack';
  private config: IMConfig;
  private messageHandler?: (msg: IMMessage) => void;

  constructor(config: IMConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {}

  onMessage(handler: (msg: IMMessage) => void): void {
    this.messageHandler = handler;
  }

  async sendMessage(conversationId: string, message: string | IMCard): Promise<void> {
    // Slack API 调用
  }

  async pushNotification(userId: string, notification: any): Promise<void> {}

  async bindUser(imUserId: string, desktopUserId: string): Promise<void> {}

  async getBinding(desktopUserId: string): Promise<any> {
    return null;
  }

  verifySignature(timestamp: string, signature: string): boolean {
    return true;
  }
}

export class GitHubBot implements IMBot {
  platform: 'github' = 'github';
  private config: IMConfig;
  private messageHandler?: (msg: IMMessage) => void;

  constructor(config: IMConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {}

  onMessage(handler: (msg: IMMessage) => void): void {
    this.messageHandler = handler;
  }

  async sendMessage(conversationId: string, message: string | IMCard): Promise<void> {
    // GitHub API 调用
  }

  async pushNotification(userId: string, notification: any): Promise<void> {}

  async bindUser(imUserId: string, desktopUserId: string): Promise<void> {}

  async getBinding(desktopUserId: string): Promise<any> {
    return null;
  }

  verifySignature(timestamp: string, signature: string): boolean {
    return true;
  }
}
```

---

## 4. 文件结构

```
src/
├── im/
│   ├── IMBot.ts                    # IM抽象接口
│   ├── types.ts                    # 共享类型定义
│   ├── CommandParser.ts            # 命令解析器
│   ├── DispatchService.ts          # 任务分发服务
│   ├── ProgressEmitter.ts          # 进度事件发布
│   │
│   ├── feishu/
│   │   ├── FeishuBot.ts            # 飞书机器人实现
│   │   ├── FeishuConfig.ts         # 飞书配置
│   │   └── FeishuService.ts        # 飞书服务入口
│   │
│   ├── connector/
│   │   ├── IMConnector.ts          # IM连接器
│   │   ├── SlackBot.ts             # Slack机器人
│   │   └── GitHubBot.ts            # GitHub机器人
│   │
│   └── store/
│       ├── bindingStore.ts         # 用户绑定存储 (JSON文件)
│       └── sessionStore.ts         # 会话状态存储
│
├── main/
│   ├── ipcHandlers.ts               # 更新: 添加飞书相关handler
│   └── server/
│       └── webhookServer.ts        # Webhook服务器 (Express)
│
└── renderer/
    ├── components/
    │   ├── FeishuPanel.tsx         # 飞书配置面板
    │   └── TakeoverModal.tsx       # 更新: 添加飞书接管
    │
    └── stores/
        └── imStore.ts              # 飞书状态管理
```

### 4.1 BindingStore 设计

```typescript
// src/im/store/bindingStore.ts

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

interface BindingRecord {
  imUserId: string;
  desktopUserId: string;
  imPlatform: string;
  boundAt: number;
  lastActive: number;
}

class BindingStore {
  private filePath: string;
  private bindings: Map<string, BindingRecord> = new Map();

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'im-bindings.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        this.bindings = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('[BindingStore] Load failed:', error);
    }
  }

  private save(): void {
    try {
      const data = Object.fromEntries(this.bindings);
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[BindingStore] Save failed:', error);
    }
  }

  set(imUserId: string, binding: BindingRecord): void {
    this.bindings.set(imUserId, binding);
    this.save();
  }

  get(imUserId: string): BindingRecord | undefined {
    return this.bindings.get(imUserId);
  }

  getByDesktopUserId(desktopUserId: string): BindingRecord | undefined {
    for (const binding of this.bindings.values()) {
      if (binding.desktopUserId === desktopUserId) {
        return binding;
      }
    }
    return undefined;
  }

  delete(imUserId: string): void {
    this.bindings.delete(imUserId);
    this.save();
  }

  getAll(): BindingRecord[] {
    return Array.from(this.bindings.values());
  }
}

let bindingStoreInstance: BindingStore | null = null;

export function getBindingStore(): BindingStore {
  if (!bindingStoreInstance) {
    bindingStoreInstance = new BindingStore();
  }
  return bindingStoreInstance;
}

export type { BindingRecord };
```

### 4.2 SessionStateMachine 设计

```typescript
// src/im/store/sessionStore.ts

import { EventEmitter } from 'events';

type SessionState =
  | 'idle'
  | 'awaiting_confirmation'
  | 'collecting_params'
  | 'executing'
  | 'completed';

interface SessionContext {
  sessionId: string;
  userId: string;
  conversationId: string;
  state: SessionState;
  taskId?: string;
  data: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

class SessionStateMachine extends EventEmitter {
  private sessions: Map<string, SessionContext> = new Map();
  private readonly TIMEOUT = 300000; // 5分钟超时

  createSession(userId: string, conversationId: string): string {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session: SessionContext = {
      sessionId,
      userId,
      conversationId,
      state: 'idle',
      data: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    console.log('[SessionStateMachine] Session created:', sessionId);
    return sessionId;
  }

  transition(sessionId: string, newState: SessionState, data?: Record<string, any>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn('[SessionStateMachine] Session not found:', sessionId);
      return;
    }

    const oldState = session.state;
    session.state = newState;
    session.updatedAt = Date.now();

    if (data) {
      session.data = { ...session.data, ...data };
    }

    console.log('[SessionStateMachine] Transition:', sessionId, oldState, '->', newState);
    this.emit('state:change', sessionId, oldState, newState);
  }

  getSession(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  getOrCreate(userId: string, conversationId: string): SessionContext {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.conversationId === conversationId) {
        if (Date.now() - session.updatedAt > this.TIMEOUT) {
          this.sessions.delete(session.sessionId);
          break;
        }
        return session;
      }
    }

    const sessionId = this.createSession(userId, conversationId);
    return this.sessions.get(sessionId)!;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

let sessionStoreInstance: SessionStateMachine | null = null;

export function getSessionStore(): SessionStateMachine {
  if (!sessionStoreInstance) {
    sessionStoreInstance = new SessionStateMachine();
  }
  return sessionStoreInstance;
}

export type { SessionContext, SessionState };
```

### 4.3 WebhookServer 设计

```typescript
// src/main/server/webhookServer.ts

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { getFeishuBot } from '../../im/feishu/FeishuBot';

interface WebhookConfig {
  port: number;
  path: string;
  encryptKey?: string;
}

export class WebhookServer {
  private app: express.Application;
  private config: WebhookConfig;

  constructor(config: WebhookConfig) {
    this.app = express();
    this.config = config;
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf.toString();
        },
      })
    );
  }

  async start(): Promise<void> {
    this.app.post(this.config.path, async (req: Request, res: Response) => {
      try {
        const { type, timestamp, signature } = req.headers;

        const bot = getFeishuBot();

        if (this.config.encryptKey && timestamp && signature) {
          if (!bot.verifySignature(timestamp as string, signature as string)) {
            console.warn('[WebhookServer] Invalid signature');
            return res.status(401).json({ error: 'Invalid signature' });
          }
        }

        await bot.handleCallback(req.body);
        res.json({ success: true });
      } catch (error) {
        console.error('[WebhookServer] Handle callback failed:', error);
        res.status(500).json({ error: 'Internal error' });
      }
    });

    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    this.app.listen(this.config.port, () => {
      console.log('[WebhookServer] Started on port', this.config.port);
    });
  }
}
```

---

## 5. 安全加固

### 5.1 消息频率限制

```typescript
interface RateLimiter {
  maxRequests: number;
  windowMs: number;
}

class MessageRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly config: RateLimiter = { maxRequests: 20, windowMs: 60000 };

  isAllowed(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];

    const recentRequests = userRequests.filter((t) => now - t < this.config.windowMs);

    if (recentRequests.length >= this.config.maxRequests) {
      console.warn('[RateLimiter] User exceeded limit:', userId);
      return false;
    }

    recentRequests.push(now);
    this.requests.set(userId, recentRequests);
    return true;
  }
}
```

### 5.2 敏感操作二次确认

需要二次确认的操作:

- 接管控制
- 取消执行中的任务
- 删除任务记录

```typescript
const SENSITIVE_COMMANDS = ['接管', '交还', '取消'];
const requiresConfirmation = (command: string) => SENSITIVE_COMMANDS.includes(command);
```

### 5.3 配置安全

```typescript
interface FeishuSecureConfig {
  appId: string;
  appSecret: string;
  encryptKey: string;
  webhookUrl: string;
  allowedChatIds?: string[];
}
```

---

## 6. 与 Scheduler 集成

### 6.1 任务转发流程

```
飞书消息 → DispatchService.handleTask()
           ↓
         DispatchService.forwardToDesktop()
           ↓
         scheduler.executeTask({ description, ... })
           ↓
         TaskExecutor 执行任务
           ↓
         ProgressEmitter 发送进度事件
           ↓
         DispatchService.updateTaskStatus() → 推送飞书
```

### 6.2 复用 v0.6 TaskQueue

飞书任务复用 v0.6 TaskQueue:

- 通过 Scheduler 触发执行
- 支持优先级队列
- 支持并发控制

```typescript
// DispatchService.forwardToDesktop 复用
const scheduler = getScheduler();
await scheduler.executeTask({
  name: task.id,
  description: task.description,
  type: 'one-time',
  schedule: null,
  enabled: true,
});
```

---

## 7. 实施计划

### Week 29-30: 飞书机器人基础

| 任务          | 交付物             |
| ------------- | ------------------ |
| 飞书应用配置  | App ID/Secret获取  |
| FeishuBot     | 消息接收、签名验证 |
| CommandParser | 命令解析           |
| Webhook服务器 | 接收飞书回调       |
| 基础回复      | 任务确认消息       |

### Week 31-32: 任务转发与结果推送

| 任务         | 交付物                      |
| ------------ | --------------------------- |
| 任务转发     | 飞书消息→Desktop TaskEngine |
| 企业消息订阅 | 主动推送配置                |
| 结果卡片     | 卡片消息构建                |
| 状态查询     | 状态/列表命令               |

### Week 33: 进度推送与接管控制

| 任务            | 交付物           |
| --------------- | ---------------- |
| ProgressEmitter | 进度事件发布订阅 |
| 进度推送        | 执行进度通知     |
| 接管指令        | 接管/交还命令    |

### Week 33-34: 对话式交互

| 任务         | 交付物           |
| ------------ | ---------------- |
| 会话状态机   | 多轮对话状态管理 |
| 任务确认     | 确认后执行       |
| 复杂任务引导 | 参数收集对话     |

### Week 34-36: Connectors

| 任务        | 交付物                  |
| ----------- | ----------------------- |
| IMConnector | 统一连接器              |
| SlackBot    | Slack机器人 (v1.0预留)  |
| GitHubBot   | GitHub机器人 (v1.0预留) |

### Week 37-38: 审计与完成

| 任务     | 交付物             |
| -------- | ------------------ |
| 操作审计 | 完整审计日志       |
| 安全加固 | 签名验证、频率限制 |
| 文档更新 | USER_GUIDE.md      |
| 发布     | GitHub tag v0.7.0  |

---

## 8. 成功指标

| 指标           | 目标值  |
| -------------- | ------- |
| 消息响应时间   | < 500ms |
| 任务转发成功率 | > 95%   |
| 进度推送到达率 | > 90%   |
| 命令识别准确率 | > 98%   |
| 接管响应时间   | < 1s    |

---

_本文档最终解释权归技术团队所有_
