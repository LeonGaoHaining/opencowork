# OpenCowork v0.8.1 技术规格说明书

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.8.1     |
| 更新日期 | 2026-04-06 |
| 状态     | 规划中     |
| 基于PRD  | v3.2       |
| 前置版本 | v0.8       |

---

## 目录

1. [版本目标](#1-版本目标)
2. [技术架构](#2-技术架构)
3. [核心模块设计](#3-核心模块设计)
   - [3.1 FeishuBot 长连接改造](#31-feishubot-长连接改造)
   - [3.2 IPC Handler](#32-ipc-handler)
4. [接口设计](#4-接口设计)
   - [4.1 IPC接口](#41-ipc接口)
   - [4.2 配置接口](#42-配置接口)
5. [错误处理](#5-错误处理)
6. [文件结构](#6-文件结构)
7. [实施计划](#7-实施计划)
8. [成功指标](#8-成功指标)
9. [附录](#9-附录)

---

## 1. 版本目标

**目标**: 飞书机器人长连接架构升级，从HTTP Webhook改为WebSocket长连接

### 核心目标

| 目标           | 说明                              |
| -------------- | --------------------------------- |
| **长连接架构** | 飞书采用WebSocket，无需公网服务器 |
| **配置简化**   | 移除verificationToken/encryptKey  |
| **SDK集成**    | 使用@larksuiteoapi/node-sdk       |

### 长连接 vs Webhook 对比

| 对比项      | Webhook模式(v0.7) | 长连接模式(v0.8.1) |
| ----------- | ----------------- | ------------------ |
| 公网服务器  | 必须              | 不需要             |
| 回调URL配置 | 必须              | 不需要             |
| 加密/签名   | 需自行实现        | SDK内置            |
| 防火墙      | 需要              | 不需要             |
| 内网穿透    | 需要              | 不需要             |
| 开发周期    | 1周               | 5分钟              |

### 与 v0.7 关系

| 组件     | v0.7 实现                     | v0.8.1 变更       |
| -------- | ----------------------------- | ----------------- |
| 飞书通信 | HTTP Webhook服务器            | WebSocket长连接   |
| 消息接收 | 轮询HTTP回调                  | SDK主动推送       |
| 配置项   | appId/appSecret/token/encrypt | 仅appId/appSecret |

---

## 2. 技术架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Process                              │
│                                                                  │
│  ┌──────────────────────────┴──────────────────────────────┐    │
│  │  FeishuBot (长连接模式)                                  │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │  WSClient (SDK)                                  │   │    │
│  │  │  └── EventDispatcher                             │   │    │
│  │  │      └── im.message.receive_v1                   │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  │                          │                               │    │
│  │                          ▼                               │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │  handleMessageEvent()                            │   │    │
│  │  │  └── DispatchService.handleMessage()             │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              │ wss://open.feishu.cn             │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   飞书开放平台       │
                    └─────────────────────┘
```

### 2.2 模块职责

| 模块            | 职责                                   |
| --------------- | -------------------------------------- |
| WSClient        | SDK长连接客户端，管理WebSocket生命周期 |
| EventDispatcher | 事件分发器，注册和处理飞书事件         |
| FeishuBot       | 业务层封装，处理消息和推送             |
| DispatchService | 任务分发服务（已有，不变）             |

---

## 3. 核心模块设计

### 3.1 FeishuBot 长连接改造

**位置**: `src/im/feishu/FeishuBot.ts`

**变更**: 从HTTP Webhook改为WebSocket长连接

#### 现有结构 (v0.7 - Webhook)

```typescript
// v0.7: HTTP服务器接收回调
class FeishuBot implements IMBot {
  private webhookServer?: http.Server;

  async initialize(): Promise<void> {
    // 启动HTTP服务器
    this.webhookServer = http.createServer(this.handleRequest.bind(this));
    this.webhookServer.listen(this.config.port);
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // 解析飞书回调
    const payload = await this.parseCallback(req);

    // 验证签名
    if (!this.verifySignature(payload)) {
      res.writeHead(401);
      res.end();
      return;
    }

    await this.handleCallback(payload);
    res.writeHead(200);
    res.end();
  }
}
```

#### 新结构 (v0.8.1 - 长连接)

基于官方 [Echo Bot 示例](https://open.feishu.cn/document/develop-an-echo-bot/explanation-of-example-code#-cd9d1bb) 实现：

```typescript
// v0.8.1: WebSocket长连接
import * as Lark from '@larksuiteoapi/node-sdk';
import { IMMessage, IMBot } from '../types';

class FeishuBot implements IMBot {
  platform: 'feishu' = 'feishu';
  private wsClient?: Lark.WSClient;
  private client?: Lark.Client;
  private eventDispatcher: Lark.EventDispatcher;
  private messageHandler?: (msg: IMMessage) => void;

  async initialize(): Promise<void> {
    // 创建 API Client（用于发送消息）
    this.client = new Lark.Client({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
    });

    // 创建事件分发器（两个参数必须为空字符串，长连接不需要）
    this.eventDispatcher = new Lark.EventDispatcher({}).register({
      /**
       * 注册接收消息事件
       * 事件类型: im.message.receive_v1
       * 文档: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
       */
      'im.message.receive_v1': async (data: any) => {
        console.log('[FeishuBot] Received message:', JSON.stringify(data));
        await this.handleMessageEvent(data);
      },
    });

    // 创建长连接客户端
    this.wsClient = new Lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
    });

    // 启动长连接
    this.wsClient.start({ eventDispatcher: this.eventDispatcher });
    console.log('[FeishuBot] WebSocket client started');
  }

  private async handleMessageEvent(data: any): Promise<void> {
    const { message } = data;

    // 解析消息内容
    const { content, message_type, chat_type, chat_id, message_id } = message;

    // 解析用户发送的消息
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

    // 调用消息处理器（DispatchService）
    if (this.messageHandler) {
      const imMessage: IMMessage = {
        id: message_id,
        type: 'text',
        content: text,
        chatId: chat_id,
        chatType: chat_type, // 'p2p' 或 'group'
        userId: data.sender?.sender_id?.user_id || '',
      };
      await this.messageHandler(imMessage);
    }
  }

  /**
   * 发送消息
   * 私聊(p2p): 使用发送消息接口
   * 群聊: 使用回复消息接口
   */
  async sendMessage(conversationId: string, message: string, chatType: string): Promise<void> {
    if (!this.client) {
      throw new Error('[FeishuBot] Client not initialized');
    }

    const content = JSON.stringify({ text: message });

    try {
      if (chatType === 'p2p') {
        // 私聊: 使用发送消息接口
        // 文档: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
        await this.client.im.v1.message.create({
          params: {
            receive_id_type: 'chat_id',
          },
          data: {
            receive_id: conversationId,
            content: content,
            msg_type: 'text',
          },
        });
      } else {
        // 群聊: 使用回复消息接口
        // 文档: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/reply
        await this.client.im.v1.message.reply({
          path: {
            message_id: conversationId,
          },
          data: {
            content: content,
            msg_type: 'text',
          },
        });
      }
    } catch (error) {
      console.error('[FeishuBot] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * 推送通知（主动推送）
   */
  async pushNotification(userId: string, notification: string): Promise<void> {
    // TODO: 实现主动推送到指定用户
    console.log('[FeishuBot] Push notification to', userId, ':', notification);
  }

  onMessage(handler: (msg: IMMessage) => void): void {
    this.messageHandler = handler;
  }
}
```

#### 关键实现说明

| 实现点              | 说明                                                        |
| ------------------- | ----------------------------------------------------------- |
| **WSClient**        | 长连接客户端，自动管理与飞书平台的WebSocket连接             |
| **Client**          | API客户端，用于发送消息                                     |
| **EventDispatcher** | 事件分发器，注册 `im.message.receive_v1` 事件处理           |
| **chat_type 区分**  | `p2p` 使用发送消息接口，其他使用回复消息接口                |
| **消息解析**        | `message_type === 'text'` 时解析 `JSON.parse(content).text` |
| **Token管理**       | SDK自动处理，无需手动刷新                                   |

#### 配置简化

| 字段              | v0.7 (Webhook) | v0.8.1 (长连接) |
| ----------------- | -------------- | --------------- |
| appId             | ✅ 必填        | ✅ 必填         |
| appSecret         | ✅ 必填        | ✅ 必填         |
| verificationToken | ✅ 必填        | ❌ 不需要       |
| encryptKey        | ✅ 可选        | ❌ 不需要       |
| webhookUrl        | ✅ 必填        | ❌ 不需要       |
| port              | ✅ 必填        | ❌ 不需要       |
| privateKey        | ❌ 不支持      | ❌ 不需要       |

#### 服务重连逻辑

```typescript
class FeishuService {
  private bot: FeishuBot | null = null;

  async reload(): Promise<void> {
    console.log('[FeishuService] Reloading...');

    // 停止现有连接
    if (this.bot) {
      // WSClient不需要显式关闭，自动处理
      this.bot = null;
    }

    // 重新初始化
    const config = loadFeishuConfig();
    if (config.enabled) {
      this.bot = createFeishuBot(config);
      await this.bot.initialize();
    }

    console.log('[FeishuService] Reload complete');
  }
}
```

### 3.2 IPC Handler

**位置**: `src/main/ipcHandlers.ts`

**新增处理函数**:

```typescript
// im:test - 测试连接
ipcMain.handle('im:test', async (event, { platform, config }) => {
  const timeout = 5000;
  try {
    const result = await Promise.race([
      testConnection(platform, config),
      new Promise((_, reject) => setTimeout(() => reject(new Error('连接超时(5s)')), timeout)),
    ]);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// im:status - 获取连接状态
ipcMain.handle('im:status', async (event, { platform }) => {
  return imService.getStatus(platform);
});
```

---

## 4. 接口设计

### 4.1 IPC接口

| 接口        | 参数                   | 返回值                                               | 说明         |
| ----------- | ---------------------- | ---------------------------------------------------- | ------------ |
| `im:load`   | -                      | `Record<IMPlatform, IMPlatformConfig>`               | 加载所有配置 |
| `im:save`   | `{ platform, config }` | `{ success: boolean; error?: string }`               | 保存配置     |
| `im:test`   | `{ platform, config }` | `{ success: boolean; result?: any; error?: string }` | 测试连接     |
| `im:status` | `{ platform }`         | `ConnectionStatus`                                   | 获取状态     |

### 4.2 配置接口

**FeishuConfig**:

```typescript
interface FeishuConfig {
  appId: string; // 以cli_开头
  appSecret: string;
  enabled?: boolean;
}
```

**config/feishu.json**:

```json
{
  "enabled": true,
  "appId": "cli_xxxxxxxxxxxxxxxxxxxxxxxx",
  "appSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

---

## 5. 错误处理

### 5.1 错误码

| 错误码                     | 说明         | 处理方式            |
| -------------------------- | ------------ | ------------------- |
| `IM_CONFIG_INVALID`        | 配置格式错误 | 提示用户修正        |
| `IM_CONFIG_SAVE_FAILED`    | 保存失败     | 重试或检查权限      |
| `IM_CONNECTION_TIMEOUT`    | 连接超时(5s) | 检查网络或配置      |
| `IM_CONNECTION_FAILED`     | 连接失败     | 检查appId/appSecret |
| `IM_SERVICE_RELOAD_FAILED` | 服务重载失败 | 回退到之前配置      |

### 5.2 长连接异常处理

```typescript
// WSClient会自动处理重连，业务层不需要额外处理
this.wsClient = new Lark.WSClient({
  appId: this.config.appId,
  appSecret: this.config.appSecret,
});

// SDK内部会自动重连，业务层只需处理消息
this.eventDispatcher.register({
  'im.message.receive_v1': async (data) => {
    try {
      await this.handleMessageEvent(data);
    } catch (error) {
      console.error('[FeishuBot] Handle message error:', error);
    }
  },
});
```

---

## 6. 文件结构

```
src/
├── im/
│   └── feishu/
│       ├── FeishuBot.ts           # 长连接改造
│       ├── FeishuService.ts       # 服务重载逻辑
│       └── types.ts               # 类型定义
└── main/
    └── ipcHandlers.ts              # 新增 im:* handlers
```

**修改文件清单**:

| 文件                             | 变更                 |
| -------------------------------- | -------------------- |
| `src/im/feishu/FeishuBot.ts`     | HTTP→WebSocket长连接 |
| `src/im/feishu/FeishuService.ts` | 添加reload()方法     |

---

## 7. 实施计划

### Week 44 (后半周)

| Day     | Task                  | 交付物           |
| ------- | --------------------- | ---------------- |
| Thu     | FeishuBot长连接改造   | FeishuBot.ts     |
| Fri     | FeishuService重载逻辑 | FeishuService.ts |
| Sat-Sun | 单元测试              | 测试报告         |

### 里程碑

| 里程碑         | 日期        | 交付内容                         |
| -------------- | ----------- | -------------------------------- |
| M1: 长连接完成 | Week 44结束 | 飞书长连接正常工作，消息接收正常 |

---

## 8. 成功指标

| 指标           | 目标      | 验证方式           |
| -------------- | --------- | ------------------ |
| 长连接稳定性   | 24h不断开 | 持续运行测试       |
| 消息接收成功率 | >99%      | 发送100条测试消息  |
| SDK重连成功率  | 100%      | 模拟断网测试       |
| 配置热更新时间 | <2s       | 保存到服务重连完成 |

---

## 9. 附录

### 9.1 飞书长连接SDK

**安装**:

```bash
npm install @larksuiteoapi/node-sdk@1.36.0
```

**官方参考文档**:

| 文档              | 链接                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 长连接配置指南    | https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/event-subscription-guide/callback-subscription/configure-callback-request-address |
| **Echo Bot 示例** | **https://open.feishu.cn/document/develop-an-echo-bot/explanation-of-example-code#-cd9d1bb**                                            |
| 消息接收事件      | https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive                                            |
| 发送消息接口      | https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create                                                    |
| 回复消息接口      | https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/reply                                                     |
| Node.js SDK       | https://github.com/larksuite/node-sdk                                                                                                   |

### 9.2 SDK使用限制

- 长连接模式仅支持企业自建应用
- 每个应用最多建立50个连接
- 接收消息需在3秒内处理

### 9.3 Echo Bot 核心逻辑

```
用户发送消息
    ↓
EventDispatcher 接收 im.message.receive_v1 事件
    ↓
解析消息内容 (JSON.parse(content).text)
    ↓
判断 chat_type:
    ├── 'p2p' (私聊) → client.im.v1.message.create()
    └── 其他 (群聊) → client.im.v1.message.reply()
    ↓
发送回复消息
```

### 9.4 配置变更总结

**Before (v0.7)**:

```json
{
  "appId": "cli_xxx",
  "appSecret": "xxx",
  "verificationToken": "xxx",
  "encryptKey": "xxx",
  "port": 3000
}
```

**After (v0.8.1)**:

```json
{
  "appId": "cli_xxx",
  "appSecret": "xxx"
}
```

---

## 文档历史

| 版本   | 日期       | 修改内容                                                                                 |
| ------ | ---------- | ---------------------------------------------------------------------------------------- |
| v0.8.1 | 2026-04-06 | 初始版本                                                                                 |
| v0.8.1 | 2026-04-06 | 基于官方Echo Bot示例完善FeishuBot实现，添加私聊/群聊区分处理、消息发送接口、官方文档链接 |
