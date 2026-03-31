# OpenCowork 产品需求文档 (PRD)

| 项目     | 内容                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| 产品名称 | OpenCowork                                                                                                            |
| 文档版本 | v2.8                                                                                                                  |
| 更新日期 | 2026-03-31                                                                                                            |
| 文档状态 | v0.7 规划完成                                                                                                         |
| 基于竞品 | Claude Cowork + 原有AI Browser PRD                                                                                    |
| 技术规格 | [SPEC v0.3](./SPEC_v0.3.md), [SPEC v0.4](./SPEC_v0.4.md), [SPEC v0.5](./SPEC_v0.5.md), [SPEC_v0.6.md](./SPEC_v0.6.md) |

---

## 目录

1. [产品概述](#1-产品概述)
2. [核心功能](#2-核心功能)
3. [技术架构](#3-技术架构)
   - [3.7 工业级Browser Agent架构 (v0.3)](#37-工业级browser-agent架构-v03)
4. [多端协同系统](#4-多端协同系统-飞书机器人)
5. [任务调度系统](#5-任务调度系统)
6. [插件与生态](#6-插件与生态)
7. [安全与权限](#7-安全与权限)
8. [用户交互设计](#8-用户交互设计)
   - [8.6 浏览器预览模块](#86-浏览器预览模块)
9. [非功能需求](#9-非功能需求)
10. [路线图](#10-路线图)
11. [附录](#11-附录)

---

## 1. 产品概述

### 1.1 产品定位

OpenCowork 是一款 **AI Native Desktop Agent（AI原生桌面助手）**，让AI像人类一样使用电脑，完成复杂的多步骤任务。与传统工具不同，OpenCowork以**任务完成为导向**，用户描述目标，AI自主规划、执行并交付成果。

**核心定位**：

- 传统浏览器：人类操作浏览器 → 浏览器执行
- 传统AI助手：人类提问 → AI回答建议
- OpenCowork：**人类描述目标** → **AI完成工作并交付成果**

### 1.2 产品愿景

让AI成为真正的数字同事，能够：

- 自主操作电脑执行复杂任务
- 跨设备和应用协同工作
- 定时执行重复性任务
- 持续学习用户的偏好和习惯
- 交付可直接使用的成果（文档、表格、报告）

### 1.3 核心价值

| 价值点       | 说明                                 | 对标Cowork         |
| ------------ | ------------------------------------ | ------------------ |
| 任务自主执行 | AI完成端到端任务，无需步步干预       | ✅ Cowork核心能力  |
| 多端协同     | 手机发送任务，桌面执行，随时查看结果 | ✅ Dispatch        |
| 定时任务     | 周期性任务自动执行，如日报、周报     | ✅ Scheduled Tasks |
| 插件生态     | Skills+Connectors扩展AI专业能力      | ✅ Plugins         |
| 安全可控     | 细粒度权限，操作需确认，人类可接管   | ✅ Cowork安全设计  |
| 交付成品     | 直接生成文档、表格、报告等可用成果   | ✅ Cowork交付模式  |

### 1.4 目标用户

| 用户类型   | 使用场景                                | 优先级 |
| ---------- | --------------------------------------- | ------ |
| 企业用户   | 流程自动化、数据采集、报告生成、RPA替代 | P0     |
| 高效办公者 | 日程管理、信息整理、跨工具协同          | P0     |
| 技术开发者 | API集成、插件开发、定制化               | P1     |
| AI爱好者   | 尝鲜体验、智能助手                      | P2     |

### 1.5 与竞品对比

| 维度       | Claude Cowork        | OpenCowork                    | 传统RPA  |
| ---------- | -------------------- | ----------------------------- | -------- |
| 使用方式   | 对话+执行            | 对话+执行                     | 配置流程 |
| 多端协同   | ✅ 手机+桌面         | ✅ 手机+桌面+浏览器           | ❌       |
| 定时任务   | ✅                   | ✅                            | ⚠️ 有限  |
| 插件生态   | ✅ Skills+Connectors | ✅ Browser+CLI+Vision+Plugins | ❌       |
| 浏览器能力 | 基础                 | **强大（Browser为核心）**     | ❌       |
| 开源       | ❌                   | ✅ Apache 2.0                 | ❌       |
| 部署方式   | 云+桌面              | 本地+云                       | 本地     |

### 1.6 竞争优势

1. **Browser-centric架构**：浏览器是核心入口，网页操作能力最强
2. **三后端协同**：Browser + CLI + Vision 一体化执行
3. **开源策略**：Apache 2.0，开放核心，闭源增值
4. **定时任务**：强大的周期性任务执行能力
5. **多端Dispatch**：手机+桌面无缝协同

---

## 2. 核心功能

### 2.1 功能全景图

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenCowork 核心能力                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │   任务执行     │  │   定时调度     │  │   多端协同     │       │
│  │  Task Engine  │  │  Scheduler   │  │   Dispatch    │       │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘       │
│          │                  │                  │                │
│          ▼                  ▼                  ▼                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Action Layer (统一动作层)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│          │                  │                  │                │
│          ▼                  ▼                  ▼                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Browser    │  │     CLI     │  │    Vision    │         │
│  │   Backend    │  │   Backend   │  │   Backend    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心功能列表

#### 2.2.1 任务执行引擎

| 功能             | 描述                             | 优先级 |
| ---------------- | -------------------------------- | ------ |
| 自然语言任务分解 | 用户描述目标，AI分解为可执行步骤 | P0     |
| 多步骤自动执行   | AI自主完成复杂任务序列           | P0     |
| 实时进度反馈     | 展示任务执行状态和当前步骤       | P0     |
| 人工接管         | 一键接管，AI暂停交还控制权       | P0     |
| 操作确认         | 敏感操作需用户明确确认           | P0     |
| 结果交付         | 交付可直接使用的成果文件         | P0     |

#### 2.2.2 定时调度系统

| 功能         | 描述                          | 优先级 |
| ------------ | ----------------------------- | ------ |
| 周期任务配置 | 支持每日/每周/每月/自定义周期 | P0     |
| 定时触发     | 到了指定时间自动开始执行      | P0     |
| 任务队列     | 管理多个定时任务，按序执行    | P1     |
| 任务历史     | 查看历史执行记录和结果        | P1     |
| 异常告警     | 执行失败时通知用户            | P1     |

#### 2.2.3 多端协同（Dispatch）

| 功能       | 描述                         | 优先级 |
| ---------- | ---------------------------- | ------ |
| 设备配对   | 手机与桌面配对，建立信任关系 | P0     |
| 任务发送   | 手机端发送任务到桌面执行     | P0     |
| 状态同步   | 任务状态实时同步到手机       | P0     |
| 结果推送   | 任务完成后推送结果到手机     | P0     |
| 跨设备续接 | 在手机开始的任务可在桌面继续 | P1     |

#### 2.2.4 浏览器核心能力

| 功能       | 描述                    | 优先级 |
| ---------- | ----------------------- | ------ |
| 网页导航   | URL跳转、搜索、前进后退 | P0     |
| 元素操作   | 点击、输入、悬停、拖拽  | P0     |
| 内容提取   | 文本、图片、数据表格    | P0     |
| 页面截图   | 全屏、区域、元素级截图  | P0     |
| 表单填写   | 自动识别并填写表单      | P0     |
| 多标签管理 | 打开、关闭、切换标签    | P1     |

#### 2.2.5 CLI执行能力

| 功能     | 描述                   | 优先级 |
| -------- | ---------------------- | ------ |
| 命令执行 | 白名单内系统命令       | P0     |
| 文件操作 | 读写文件、目录管理     | P0     |
| 脚本运行 | Python、Node.js、Shell | P0     |
| API调用  | RESTful请求            | P1     |
| 进程管理 | 启动、停止、监控进程   | P1     |

#### 2.2.6 视觉理解

| 功能     | 描述                 | 优先级 |
| -------- | -------------------- | ------ |
| OCR识别  | 图片文字提取         | P0     |
| 图表解析 | 理解图表、数据可视化 | P0     |
| 视觉问答 | 基于图片的问答理解   | P1     |
| 场景识别 | 页面布局、UI元素类型 | P1     |

#### 2.2.7 插件生态

| 功能      | 描述                            | 优先级 |
| --------- | ------------------------------- | ------ |
| Skill系统 | Prompt模板+工具的技能封装       | P0     |
| Connector | 连接外部工具（Slack、Github等） | P1     |
| 插件安装  | 一键安装/卸载插件               | P1     |
| 插件市场  | 官方和第三方插件分发            | P2     |

### 2.3 典型使用场景

#### 场景1：智能数据采集

```
用户: "帮我采集这周竞品的价格变化，做成Excel表格"
AI执行:
  1. 打开竞品网站
  2. 导航到价格页面
  3. 提取本周价格数据
  4. 截图保存
  5. 整理成Excel表格
  6. 保存到指定目录
结果: 可直接使用的价格监控表格
```

#### 场景2：定时任务-每日报告

```
配置: 每天早上9点执行
任务: "从Slack、邮件、项目管理工具汇总昨日工作，生成日报"
AI执行:
  1. 连接Slack获取昨日消息摘要
  2. 连接邮件获取昨日重要邮件
  3. 连接Jira获取昨日完成任务
  4. 汇总整理成日报格式
结果: 每日推送日报到手机/邮件
```

#### 场景3：跨设备任务

```
手机端:
  用户: "帮我整理Downloads文件夹"
  AI: "已收到任务，将在桌面执行..."

桌面端(自动执行):
  1. 扫描Downloads文件夹
  2. 按类型分类文件
  3. 创建分类文件夹
  4. 移动文件到对应文件夹
  5. 生成整理报告

手机端(结果推送):
  AI: "整理完成！移动了23个文件，创建了5个分类文件夹"
```

#### 场景4：实时观看AI操作浏览器

```
用户场景: 用户让AI帮忙完成网页数据采集

用户:
  "帮我采集这周竞品的价格变化，做成Excel表格"

侧边预览（实时观看）:
  ┌─────────────────────────────────────────────────────────────┐
  │ 🔍 AI Browser Preview                                      │
  │ ┌───────────────────────────────────────────────────────┐   │
  │ │ [竞品网站页面]                                        │   │
  │ │ 🔴 AI正在点击"价格"标签                               │   │
  │ └───────────────────────────────────────────────────────┘   │
  │ URL: competitor-site.com/products                          │
  │ 操作: browser:click @ .price-tab                           │
  └─────────────────────────────────────────────────────────────┘

AI执行过程（用户实时观看）:
  1. 打开竞品网站
     → 预览显示网站加载完成

  2. 点击"价格"标签
     → 预览显示点击位置高亮，页面切换

  3. 提取本周价格数据
     → 预览显示数据区域，AI正在读取

  4. 点击下一页
     → 预览显示翻页操作

  5. 重复步骤3-4，直到采集完所有数据
     → 用户可以看到AI持续工作的过程

  6. 整理成Excel表格
     → 预览显示Excel生成过程

  7. 保存到指定目录
     → 任务完成通知

用户可以:
  • 全程观看AI的每一个操作
  • 随时点击"接管"按钮介入
  • 切换预览模式（侧边/折叠/独立窗口）
```

---

## 3. 技术架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│            (桌面UI / 手机App / 网页端 / 命令行)                   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Dispatch Layer (调度层)                      │
│           任务分发 / 设备同步 / 定时触发 / 状态管理               │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Planner (规划层)                            │
│              任务分解 / 策略生成 / 动态调整                       │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Action Layer (动作层)                         │
│              统一动作Schema / 多后端路由                          │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Executor Layer (执行层)                       │
│     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│     │   Browser    │  │     CLI     │  │    Vision    │       │
│     │   Executor   │  │   Executor  │  │   Executor   │       │
│     └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 技术栈

| 层级          | 技术选型                   | 说明               |
| ------------- | -------------------------- | ------------------ |
| 桌面框架      | Electron / Tauri           | 跨平台桌面应用     |
| 浏览器内核    | Chromium                   | 完整的浏览器能力   |
| 开发语言      | TypeScript                 | 类型安全           |
| 后端运行时    | Node.js                    | 事件驱动           |
| 手机App       | React Native / Tauri       | 跨平台移动端       |
| Agent Runtime | 自研                       | 不依赖LangChain    |
| LLM集成       | OpenAI / Anthropic / Local | 多模型支持         |
| 状态管理      | Zustand                    | 轻量级状态管理     |
| 定时任务      | node-cron / BullMQ         | 任务调度           |
| WebSocket     | Socket.IO                  | 实时通信、多端同步 |
| 数据库        | SQLite / IndexedDB         | 本地存储           |
| 打包工具      | electron-builder / Tauri   | 应用打包           |

### 3.3 核心模块

| 模块             | 职责                             |
| ---------------- | -------------------------------- |
| Dispatch Core    | 多端配对、任务分发、状态同步     |
| Scheduler        | 定时任务管理、触发执行、队列管理 |
| Task Engine      | 任务生命周期管理、状态机         |
| Planner          | 任务分解、策略生成、执行评估     |
| Action Layer     | 动作标准化、Schema定义           |
| Executor Router  | 后端路由、负载分配               |
| Browser Executor | Puppeteer/Playwright封装         |
| CLI Executor     | 白名单命令+沙箱执行              |
| Vision Executor  | OCR、图表解析                    |
| Plugin Manager   | 插件安装、卸载、生命周期         |

### 3.4 Action Schema

```typescript
enum ActionType {
  // Browser
  BROWSER_NAVIGATE = 'browser:navigate',
  BROWSER_CLICK = 'browser:click',
  BROWSER_INPUT = 'browser:input',
  BROWSER_EXTRACT = 'browser:extract',
  BROWSER_SCREENSHOT = 'browser:screenshot',

  // CLI
  CLI_EXECUTE = 'cli:execute',
  CLI_FILE_READ = 'cli:file:read',
  CLI_FILE_WRITE = 'cli:file:write',
  CLI_SCRIPT = 'cli:script',

  // Vision
  VISION_OCR = 'vision:ocr',
  VISION_UNDERSTAND = 'vision:understand',
  VISION_CHART = 'vision:chart',

  // Control
  WAIT = 'wait',
  ASK_USER = 'ask:user',
  DELIVER_RESULT = 'deliver:result',
}

interface BaseAction {
  id: string;
  type: ActionType;
  description: string;
  params: Record<string, any>;
  constraints?: {
    timeout?: number;
    retries?: number;
    requiresConfirm?: boolean;
  };
  dependsOn?: string[];
}
```

### 3.5 IPC通信设计

```typescript
// 统一IPC消息格式
interface IPCMessage {
  type: 'plan' | 'execute' | 'result' | 'dispatch' | 'schedule';
  payload: any;
  requestId: string;
  timestamp: number;
}

// 主进程 (Main Process)
ipcMain.handle('task:dispatch', async (event, task) => {
  const actions = await planner.plan(task);
  return executorRouter.routeBatch(actions);
});

ipcMain.handle('task:schedule', async (event, config) => {
  return scheduler.addTask(config);
});

ipcMain.handle('device:pair', async (event, deviceInfo) => {
  return dispatchService.pairDevice(deviceInfo);
});

// 渲染进程 (Renderer Process)
renderer.invoke('task:dispatch', { task: '帮我整理Downloads' });
renderer.invoke('task:schedule', {
  cron: '0 9 * * *',
  task: '生成日报',
  config: { channels: ['slack', 'email'] },
});
```

### 3.6 PreviewManager (浏览器预览模块)

#### 3.6.1 模块概述

PreviewManager负责管理AI浏览器操作的实时预览功能，支持三种预览模式：

| 模式                 | 说明                 | 实时性 | 资源消耗 |
| -------------------- | -------------------- | ------ | -------- |
| Sidebar (侧边预览)   | 嵌入主窗口右侧       | <50ms  | 最低     |
| Collapsible (可折叠) | 可收起/展开的面板    | <50ms  | 最低     |
| Detached (独立窗口)  | 独立的浏览器预览窗口 | <100ms | 中等     |

#### 3.6.2 技术实现

```typescript
// 技术方案：Electron BrowserView 嵌入 + 共享 Partition

// 预览模块配置接口
interface PreviewConfig {
  sidebar: {
    width: number; // 侧边预览宽度，默认500px
  };
  collapsible: {
    collapsedHeight: number; // 收起状态高度，默认40px
    expandedHeightRatio: number; // 展开高度比例，默认0.6 (60%)
  };
  detached: {
    defaultWidth: number; // 独立窗口默认宽度，默认1024px
    defaultHeight: number; // 独立窗口默认高度，默认768px
  };
}

// 默认配置
const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  sidebar: {
    width: 500,
  },
  collapsible: {
    collapsedHeight: 40,
    expandedHeightRatio: 0.6,
  },
  detached: {
    defaultWidth: 1024,
    defaultHeight: 768,
  },
};

class PreviewManager {
  private config: PreviewConfig;
  private mainWindow: BrowserWindow;
  private previewView: BrowserView;
  private automationBrowser: AutomationBrowser;

  // 三种预览模式
  private mode: 'sidebar' | 'collapsible' | 'detached';
  private detachedWindow?: BrowserWindow;

  // 可折叠模式的展开状态
  private isExpanded: boolean = false;

  // 构造函数：接收自定义配置或使用默认配置
  constructor(config: Partial<PreviewConfig> = {}) {
    this.config = { ...DEFAULT_PREVIEW_CONFIG, ...config };
  }

  // 初始化预览面板（默认侧边预览）
  async initialize(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;

    // 创建共享 partition 的 BrowserView
    this.previewView = new BrowserView({
      webPreferences: {
        partition: 'persist:automation', // 与自动化浏览器共享
      },
    });

    // 绑定到主窗口
    this.mainWindow.addBrowserView(this.previewView);

    // 默认侧边预览模式
    this.setMode('sidebar');
  }

  // 切换预览模式
  setMode(mode: 'sidebar' | 'collapsible' | 'detached') {
    this.mode = mode;

    switch (mode) {
      case 'sidebar':
        this.enableSidebarMode();
        break;
      case 'collapsible':
        this.enableCollapsibleMode();
        break;
      case 'detached':
        this.enableDetachedMode();
        break;
    }
  }
}
```

#### 3.6.3 侧边预览模式

```typescript
// 侧边预览：嵌入主窗口右侧，默认显示
private enableSidebarMode() {
  // 关闭独立窗口（如果存在）
  this.detachedWindow?.close();
  this.detachedWindow = undefined;

  // 添加 BrowserView 到主窗口
  if (!this.mainWindow.getBrowserView()) {
    this.mainWindow.addBrowserView(this.previewView);
  }

  // 设置位置和大小 (使用配置的侧边宽度)
  this.previewView.setBounds({
    x: this.mainWindow.getBounds().width - this.config.sidebar.width,
    y: 0,
    width: this.config.sidebar.width,
    height: this.mainWindow.getBounds().height
  });

  // 确保可见
  this.previewView.setAutoResize({ width: true, height: true });
}
```

#### 3.6.4 可折叠预览模式

```typescript
  // 可折叠预览：默认收起只显示标签，点击展开
private enableCollapsibleMode() {
  if (this.isExpanded) {
    // 展开状态：使用配置的高度比例
    this.previewView.setBounds({
      x: 0,
      y: 0,
      width: this.mainWindow.getBounds().width,
      height: this.mainWindow.getBounds().height * this.config.collapsible.expandedHeightRatio
    });
  } else {
    // 收起状态：使用配置的收起高度
    this.previewView.setBounds({
      x: 0,
      y: 0,
      width: this.mainWindow.getBounds().width,
      height: this.config.collapsible.collapsedHeight
    });
  }

  // 监听点击切换展开/收起
  this.previewView.webContents.on('input-event', (event, input) => {
    if (input.type === 'mouseClick' && input.x < 100 && input.y < 40) {
      this.isExpanded = !this.isExpanded;
      this.setMode('collapsible');
    }
  });
}
```

#### 3.6.5 独立窗口模式

```typescript
// 独立窗口：弹出独立窗口，可拖到副屏
private enableDetachedMode() {
  // 从主窗口移除 BrowserView
  this.mainWindow.removeBrowserView(this.previewView);

  // 创建独立窗口（使用配置的尺寸）
  this.detachedWindow = new BrowserWindow({
    width: this.config.detached.defaultWidth,
    height: this.config.detached.defaultHeight,
    title: 'OpenCowork - Browser Preview',
    webPreferences: {
      partition: 'persist:automation',  // 共享 partition
    }
  });

  // 将 BrowserView 附加到独立窗口
  this.detachedWindow.addBrowserView(this.previewView);
  this.previewView.setBounds({
    x: 0,
    y: 0,
    width: this.config.detached.defaultWidth,
    height: this.config.detached.defaultHeight
  });

  // 独立窗口关闭时，切换回侧边预览
  this.detachedWindow.on('closed', () => {
    this.detachedWindow = undefined;
    this.setMode('sidebar');
  });
}
```

#### 3.6.6 画面同步机制

```typescript
// BrowserView 与 Automation Browser 共享 partition 实现画面同步
class AutomationBrowser {
  private browser: Browser;
  private automationPage: Page;

  // 创建自动化页面
  async createPage(): Promise<Page> {
    const context = await this.browser.newContext({
      partition: 'persist:automation', // 关键：共享 partition
    });
    this.automationPage = await context.newPage();
    return this.automationPage;
  }

  // 获取共享 context
  getSharedPartition(): string {
    return 'persist:automation';
  }
}

// PreviewManager 绑定到同一 partition
class PreviewManager {
  async bindToAutomation(automationPage: Page) {
    // 通过 CDP 会话绑定实现画面同步
    // PreviewView 和 AutomationPage 共享同一个 BrowserContext (partition)
    // 需要建立 CDP 会话确保画面实时同步

    const cdpSession = await this.previewView.webContents.createCDPSession();

    // 启用页面相关域
    await cdpSession.send('Page.enable');
    await cdpSession.send('DOM.enable');

    // 监听自动化页面的帧更新事件，同步到预览视图
    automationPage.on('framenavigated', (frame) => {
      // 确保预览视图反映最新的frame内容
    });

    // 监听控制台消息，用于调试
    cdpSession.on('Runtime.consoleAPICalled', (event) => {
      console.log('Browser console:', event.params.args);
    });
  }
}
```

#### 3.6.7 预览控制栏

```typescript
// 预览面板顶部控制栏
interface PreviewControlBar {
  modeSwitcher: 'sidebar' | 'collapsible' | 'detached';
  currentMode: PreviewMode;
  takeoverButton: boolean;
  closeButton: boolean;
}

const previewControlBar = `
┌─────────────────────────────────────────────────────────────┐
│ [👁️ 侧边] [📱 窗口] [🔲 折叠]   当前: 侧边预览  [接管] │
└─────────────────────────────────────────────────────────────┘
`;
// 说明：[×] 关闭预览面板（任务继续执行，仅隐藏预览视图）

// 预览面板内容
interface PreviewContent {
  url: string;
  currentAction: string;
  screenshot?: string;
}
```

#### 3.6.8 模块结构

```
src/
├── preview/
│   ├── PreviewManager.ts       # 预览管理器主类（方法模式）
│   ├── ViewCoordinator.ts      # 视图协调器
│   └── types.ts                # 类型定义（PreviewConfig等）
```

**实现说明**：采用方法模式而非策略模式，三个模式通过内部方法切换，代码更简洁。

### 3.7 工业级Browser Agent架构 (v0.3)

> 详细技术规格请参考：[SPEC v0.3](./SPEC_v0.3.md)

为实现任务成功率85-95%的工业级Browser Agent，v0.3引入全新架构。

#### 3.7.1 架构概述

```
User Task
    ↓
Task Planner（高层规划）
    ↓
┌─────────────────────────────────────────────┐
│              Agent Loop (核心)               │
│  Observe → Decide → Act → Verify → Recovery │
│       ↑                              ↓      │
│       └──────── 失败后触发 ←────────┘      │
└─────────────────────────────────────────────┘
         ↓
    ShortTermMemory
```

#### 3.7.2 核心原则

| 原则            | 说明                                            |
| --------------- | ----------------------------------------------- |
| **LLM只做决策** | LLM不直接操控浏览器，输出语义ID而非selector     |
| **DOM转语义图** | UIGraph将DOM转换为语义化元素，LLM只看到语义信息 |
| **验证驱动**    | 每步执行后必须验证，及时发现失败                |
| **失败后观察**  | Observer只在失败后调用，减少开销                |

#### 3.7.3 核心模块

| 模块                | 职责                    | 预期提升           |
| ------------------- | ----------------------- | ------------------ |
| **UIGraph**         | DOM转换为语义化元素图谱 | LLM理解准确率+30%  |
| **Observer**        | 失败后捕获页面状态      | 减少错误上下文丢失 |
| **Verifier**        | 验证每步执行结果        | 及时发现失败+20%   |
| **RecoveryEngine**  | LLM决策恢复策略         | 恢复成功率+30%     |
| **ShortTermMemory** | 记录成功/失败轨迹       | 避免重复错误       |

> 各模块详细设计说明见 [SPEC v0.3 第4章](./SPEC_v0.3.md#4-核心模块设计)

#### 3.7.4 反爬虫机制

当前反爬虫实现位于 `BrowserExecutor.ts` 第94-151行 `ensureBrowser()` 方法。

| 检测点                | 实现方式                                        | 状态        |
| --------------------- | ----------------------------------------------- | ----------- |
| `navigator.webdriver` | `Object.defineProperty` 设为 `undefined`        | ✅ 已实现   |
| `permissions.query`   | 返回 `default`/`prompt`，只处理notifications    | ⚠️ 已知弱点 |
| `navigator.plugins`   | 伪造为 `[1,2,3,4,5]`                            | ✅ 已实现   |
| `chrome.runtime`      | 未实现                                          | ⚠️ 已知弱点 |
| Chromium Flag         | `--disable-blink-features=AutomationControlled` | ✅ 已实现   |

> 详细说明见 [SPEC v0.3 第2章](./SPEC_v0.3.md#2-反爬虫机制)

#### 3.7.5 成功指标

| 指标         | v0.2 | v0.3目标   |
| ------------ | ---- | ---------- |
| 任务成功率   | ~65% | **85-95%** |
| 点击准确率   | ~80% | **>95%**   |
| 单步延迟     | 2-5s | **1-3s**   |
| 失败后恢复率 | ~50% | **>80%**   |

#### 3.7.6 实施里程碑

| 周次     | 任务                     | 交付                                                        |
| -------- | ------------------------ | ----------------------------------------------------------- |
| Week 1-2 | UIGraph语义层 + Observer | types/uiElement.ts, browser/uiGraph.ts, browser/observer.ts |
| Week 2-3 | Verifier验证层           | executor/verifier.ts                                        |
| Week 3-4 | RecoveryEngine恢复引擎   | recovery/recoveryEngine.ts                                  |
| Week 4-5 | ShortTermMemory          | memory/shortTermMemory.ts                                   |
| Week 5-6 | 集成到TaskEngine + 测试  | 端到端测试，达到85%+ 成功率                                 |

---

## 4. 多端协同系统 (飞书机器人)

### 4.1 Dispatch架构

```
┌─────────────────┐         ┌─────────────────┐
│   飞书 App      │◄──────►│   Desktop App   │
│                 │ HTTPS  │                 │
│  • @机器人发送  │Webhook │  • 任务执行    │
│  • 接收卡片    │        │  • 结果生成     │
│  • 推送通知   │        │  • Browser执行  │
└─────────────────┘         └─────────────────┘
        │                            │
        └──────────┬─────────────────┘
                   ▼
           ┌─────────────────┐
           │  Feishu Bot     │
           │  Service        │
           │  (消息队列)    │
           └─────────────────┘
```

### 4.2 飞书机器人功能

| 功能       | 说明                       |
| ---------- | -------------------------- |
| 任务发送   | 用户@机器人发送任务描述    |
| 任务确认   | 机器人回复确认消息         |
| 结果推送   | 任务完成后主动推送结果卡片 |
| 状态查询   | 用户发送指令查询任务状态   |
| 进度推送   | 执行过程中推送进度通知     |
| 接管控制   | 手机发送指令接管桌面任务   |
| 对话式交互 | 机器人与用户多轮对话       |

### 4.3 机器人命令体系

| 命令                    | 示例                      | 说明         |
| ----------------------- | ------------------------- | ------------ |
| `@机器人 任务描述`      | `@OpenCowork 帮我订机票`  | 发送新任务   |
| `@机器人 状态 [任务ID]` | `@OpenCowork 状态 abc123` | 查询状态     |
| `@机器人 列表`          | `@OpenCowork 列表`        | 查看最近任务 |
| `@机器人 接管 [任务ID]` | `@OpenCowork 接管 abc123` | 接管任务     |
| `@机器人 交还`          | `@OpenCowork 交还`        | 交还控制给AI |
| `@机器人 取消 [任务ID]` | `@OpenCowork 取消 abc123` | 取消任务     |
| `@机器人 帮助`          | `@OpenCowork 帮助`        | 获取帮助     |

### 4.4 企业消息订阅

为实现任务进度主动推送，需要配置企业消息订阅：

- 飞书开放平台 → 企业自建应用 → 消息订阅
- 订阅事件：`im.message.receive`
- 建立长连接，实时接收消息并推送通知

### 4.5 设备绑定

```typescript
// 用户绑定关系
interface FeishuBinding {
  feishuOpenId: string; // 飞书用户ID
  desktopUserId: string; // 桌面端用户ID
  boundAt: number;
}

// 任务分发
interface DispatchTask {
  id: string;
  description: string;
  source: 'feishu' | 'desktop';
  priority: 'low' | 'normal' | 'high';
}
```

### 4.6 IM 抽象接口 (扩展预留)

为支持未来扩展（钉钉/企业微信），预留统一接口：

```typescript
interface IMBot {
  platform: 'feishu' | 'dingtalk' | 'wecom';

  // 消息处理
  onMessage(handler: (msg: IMMessage) => void): void;

  // 主动推送
  pushMessage(userId: string, message: IMMessage): Promise<void>;

  // 用户绑定
  bindUser(imUserId: string, desktopUserId: string): Promise<void>;
}

// v1.0+ 可扩展
class DingTalkBot implements IMBot { ... }
class WeComBot implements IMBot { ... }
```

```typescript
// Step 1: 桌面端生成配对码
const pairingCode = await dispatchService.generatePairingCode();
// 显示配对码: "ABC123"，有效期5分钟

// Step 2: 手机端扫描/输入配对码
await mobileClient.pair(pairingCode);

// Step 3: 桌面端确认配对
await dispatchService.confirmPairing(mobileDeviceId);

// Step 4: 建立加密通道
const sharedKey = await dispatchService.establishSecureChannel(mobileDeviceId);
```

### 4.3 任务分发协议

```typescript
interface DispatchTask {
  id: string;
  taskId: string;
  description: string;
  priority: 'low' | 'normal' | 'high';
  createdAt: number;
  expiresAt?: number;
  requireAuth?: boolean;
  preferredDevice?: 'desktop' | 'mobile';
}

interface DispatchResult {
  taskId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: {
    type: 'file' | 'text' | 'link';
    content: any;
  };
  executedAt?: number;
  deviceId: string;
}
```

### 4.4 实时同步

```typescript
// WebSocket事件
const events = {
  'task:status': (data: { taskId: string; status: TaskStatus }) => void;
  'task:progress': (data: { taskId: string; step: number; total: number }) => void;
  'task:completed': (data: { taskId: string; result: DispatchResult }) => void;
  'device:status': (data: { deviceId: string; online: boolean }) => void;
  'task:takeover': (data: { taskId: string }) => void;
};

socket.on('task:progress', ({ taskId, step, total }) => {
  updateProgressUI(taskId, step, total);
});
```

### 4.5 跨设备续接

```typescript
async function resumeTaskOnDevice(taskId: string, targetDevice: 'desktop') {
  const taskState = await taskEngine.getTaskState(taskId);

  if (taskState.status === 'paused') {
    await dispatchService.sendTask({
      taskId,
      description: taskState.originalDescription,
      resumeFrom: taskState.completedSteps,
      targetDevice,
    });
  }
}
```

---

## 5. 任务调度系统

### 5.1 Scheduler架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Task Scheduler                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Cron      │  │   Interval  │  │   One-time   │        │
│  │   Jobs      │  │   Jobs      │  │   Jobs       │        │
│  │ (node-cron) │  │ (setInterval)│  │ (setTimeout) │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          ▼                                   │
│              ┌───────────────────────┐                      │
│              │    Task Queue          │                      │
│              │  • Priority Queue     │                      │
│              │  • In-memory         │                      │
│              │  • Concurrency Ctrl   │                      │
│              └───────────┬───────────┘                      │
│                          ▼                                   │
│              ┌───────────────────────┐                      │
│              │   Task Executor       │                      │
│              │   • Worker Pool        │                      │
│              │   • Concurrency Ctrl   │                      │
│              └───────────────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 定时任务配置

```typescript
interface ScheduledTask {
  id: string;
  name: string;
  description: string;

  schedule: {
    type: 'cron' | 'interval' | 'one-time';
    cron?: string;
    intervalMs?: number;
    startTime?: number;
  };

  execution: {
    device: 'any' | 'desktop' | 'mobile';
    timeout: number;
    retryOnFail: boolean;
    maxRetries: number;
  };

  notification: {
    onStart: boolean;
    onComplete: boolean;
    onFail: boolean;
    channels: ('app' | 'email' | 'push')[];
  };

  context?: {
    workingDirectory?: string;
    allowedConnectors?: string[];
    inputFiles?: string[];
  };

  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
}
```

### 5.3 预置定时任务模板

| 模板名称 | 调度       | 描述                          |
| -------- | ---------- | ----------------------------- |
| 每日早报 | 每天9:00   | 从邮件/Slack/日历汇总生成日报 |
| 周报生成 | 周五18:00  | 汇总本周工作生成周报          |
| 文件整理 | 每天23:00  | 整理Downloads文件夹           |
| 数据备份 | 每周日2:00 | 备份重要文件到指定位置        |
| 竞品监控 | 每天10:00  | 采集竞品价格更新              |
| 日程提醒 | 每天8:30   | 检查日历，发送今日日程        |

### 5.4 任务队列管理

```typescript
interface TaskQueueConfig {
  concurrency: 3;
  maxQueueSize: 100;
  defaultTimeout: 300000;

  retry: {
    maxAttempts: 3;
    backoff: 'exponential';
    initialDelay: 1000;
  };
}

enum TaskStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  EXECUTING = 'executing',
  WAITING_CONFIRM = 'waiting_confirm',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
```

---

## 6. 插件与生态

### 6.1 插件架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Plugins                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │     Skill       │  │    Connector    │                   │
│  │  (Prompt模板)    │  │   (外部集成)    │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Plugin Package                         ││
│  │  • id, name, version, author                           ││
│  │  • permissions                                          ││
│  │  • Skills + Connectors + Actions                        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Plugin Manifest

```typescript
interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email: string;
    url?: string;
  };

  permissions: {
    connectors: string[];
    fileAccess: 'none' | 'read' | 'write' | 'all';
    network: 'none' | 'limited' | 'all';
    scheduledTasks: boolean;
  };

  skills?: SkillDefinition[];
  connectors?: ConnectorDefinition[];
  actions?: ActionDefinition[];
  views?: ViewDefinition[];

  autoStart?: boolean;
  dependencies?: string[];
}
```

### 6.3 Skill定义

```yaml
# SKILL.md 示例
---
name: daily-report
description: 生成每日的汇总报告，整合多个数据源的信息
disable-auto-invoke: false
allowed-actions:
  - 'cli:file:read'
  - 'cli:file:write'
  - 'connector:slack'
  - 'connector:email'
---
# Daily Report Skill

当用户请求生成日报时，执行以下步骤：

1. **收集信息**
- 从Slack连接获取昨日重要消息摘要
- 从邮件连接获取昨日重要邮件
- 从日历连接获取昨日会议
- 从Jira连接获取昨日完成任务

2. **整理内容**
- 按项目分类整理
- 识别关键进展和 blockers
- 生成优先级列表

3. **生成报告**
- 使用报告模板
- 格式化为Markdown
- 保存到 ~/Documents/Reports/

4. **发送通知**
- 通过邮件发送给团队
- 通过Slack通知相关人员
```

### 6.4 Connector定义

```typescript
interface ConnectorDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;

  auth: {
    type: 'oauth2' | 'apikey' | 'basic' | 'none';
    fields: AuthField[];
  };

  capabilities: {
    read: Capability[];
    write: Capability[];
    subscribe?: EventType[];
  };

  endpoints: {
    base: string;
    paths: Record<string, string>;
  };
}

const slackConnector: ConnectorDefinition = {
  id: 'slack',
  name: 'Slack',
  description: '连接Slack工作区，获取消息和发送通知',

  auth: {
    type: 'oauth2',
    fields: ['clientId', 'clientSecret', 'teamId'],
  },

  capabilities: {
    read: ['channels', 'messages', 'users', 'files'],
    write: ['sendMessage', 'createChannel', 'uploadFile'],
    subscribe: ['message.created', 'reaction.added'],
  },

  endpoints: {
    base: 'https://slack.com/api',
    paths: {
      conversations: '/conversations.list',
      messages: '/conversations.history',
      send: '/chat.postMessage',
    },
  },
};
```

### 6.5 内置插件

| 插件名称           | 类型      | 功能                  |
| ------------------ | --------- | --------------------- |
| Browser Tools      | Skill     | 浏览器操作最佳实践    |
| File Organizer     | Skill     | 智能文件整理和命名    |
| Report Generator   | Skill     | 多数据源报告生成      |
| Slack Connector    | Connector | Slack消息读取和发送   |
| GitHub Connector   | Connector | Issues/PR/Commits操作 |
| Email Connector    | Connector | 邮件读取和发送        |
| Calendar Connector | Connector | 日历事件读写          |
| Notion Connector   | Connector | Notion页面和数据库    |

---

## 7. 安全与权限

### 7.1 安全架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Security Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   身份认证   │  │   权限控制   │  │   操作审计   │          │
│  │  Identity   │  │  Access     │  │   Audit     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              沙箱隔离 (Sandbox)                          ││
│  │  • Browser Context 隔离                                  ││
│  │  • CLI 命令白名单                                        ││
│  │  • 文件系统权限控制                                      ││
│  │  • 网络访问限制                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 权限级别

```typescript
enum PermissionLevel {
  FULL_ACCESS = 'full',
  STANDARD = 'standard',
  RESTRICTED = 'restricted',
  READ_ONLY = 'readonly',
}

interface PermissionConfig {
  level: PermissionLevel;

  browser: {
    allowedDomains: string[];
    blockedDomains: string[];
    screenshot: boolean;
    download: boolean;
    clipboard: 'none' | 'read' | 'write' | 'both';
  };

  cli: {
    allowedCommands: string[];
    allowedPaths: string[];
    fileWrite: boolean;
    networkAccess: boolean;
  };

  vision: {
    enabled: boolean;
    ocrLanguages: string[];
    screenCapture: boolean;
  };

  scheduler: {
    canCreateTasks: boolean;
    canModifySystemTasks: boolean;
    maxTasksPerDay: number;
  };

  dispatch: {
    canReceiveTasks: boolean;
    canSendTasks: boolean;
    allowedDevices: string[];
  };
}
```

### 7.3 操作确认机制

```typescript
const confirmableActions = [
  'browser:navigate',
  'cli:execute',
  'cli:file:write',
  'cli:file:delete',
  'deliver:result',
];

interface ConfirmationRequest {
  action: BaseAction;
  risk: 'low' | 'medium' | 'high';
  reason: string;
  alternatives?: string[];
  preview?: {
    screenshot?: string;
    fileChanges?: string;
  };
}
```

### 7.4 人工接管机制

#### 7.4.1 接管触发方式

| 触发方式           | 响应时间 | 说明           |
| ------------------ | -------- | -------------- |
| 点击"接管"按钮     | < 100ms  | 界面按钮       |
| 按 ESC 键          | < 50ms   | 快捷键         |
| 鼠标直接操作浏览器 | < 100ms  | 检测到鼠标动作 |
| 手机发送"停止"     | < 500ms  | 远程命令       |

#### 7.4.2 观看模式 vs 接管模式

```typescript
enum PreviewMode {
  VIEWING = 'viewing', // 观看模式：AI操作浏览器，用户观看
  TAKEOVER = 'takeover', // 接管模式：用户操作浏览器，AI暂停
}

// 模式切换流程
//
// 观看模式:
//   - AI正在操作浏览器
//   - 用户在侧边预览实时观看
//   - 用户可以随时接管
//
// 接管模式:
//   - 用户接管浏览器控制权
//   - AI暂停执行，等待用户操作
//   - 用户可手动完成操作或交还AI
```

#### 7.4.3 接管后用户选项

| 选项       | 说明                   |
| ---------- | ---------------------- |
| 交还AI控制 | AI从中断处继续执行     |
| 重新开始   | 清空上下文，AI重新规划 |
| 人工完成   | 任务结束，不通知AI     |

```typescript
interface TakeoverResult {
  previousStatus: TaskStatus;
  completedActions: Action[];
  pendingActions: Action[];
  aiContext: {
    currentTask: string;
    conversationHistory: Message[];
    learnedPreferences: UserPrefs;
  };
}

enum TakeoverOption {
  CONTINUE_AI = 'continue_ai', // 交还AI控制
  RESTART = 'restart', // 重新开始
  MANUAL_COMPLETE = 'manual_complete', // 人工完成
}
```

#### 7.4.4 接管界面提示

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   ⚠️ 已接管                                                  │
│                                                              │
│   AI已暂停，等待您的操作                                      │
│                                                              │
│   当前任务: 订机票                                           │
│   已完成步骤: 3/6                                           │
│                                                              │
│   [交还AI控制]  [重新开始]  [人工完成]                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 审计日志

```typescript
interface AuditLog {
  id: string;
  timestamp: number;

  actor: {
    type: 'ai' | 'user' | 'system';
    userId?: string;
    sessionId: string;
  };

  action: {
    type: ActionType;
    params: Record<string, any>;
    target?: string;
  };

  result: {
    status: 'success' | 'failed' | 'blocked' | 'confirmed';
    output?: any;
    error?: string;
    reason?: string;
  };

  security: {
    confirmedBy?: string;
    skippedConfirm?: boolean;
  };
}
```

### 7.6 企业级功能

| 功能            | 说明               |
| --------------- | ------------------ |
| Admin Dashboard | 管理员控制面板     |
| SSO集成         | 企业账号系统集成   |
| Audit Logs      | 完整操作审计       |
| Compliance API  | 合规数据导出       |
| 策略管理        | 组织级权限策略     |
| Cowork开关      | 管理员可禁用Cowork |

---

## 8. 用户交互设计

### 8.1 桌面端布局

```
┌─────────────────────────────────────────────────────────────────┐
│  OpenCowork                              [─] [□] [×]           │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────────────────────────────┐│
│ │         │ │                                                  ││
│ │ 侧边栏  │ │              主聊天区域                          ││
│ │         │ │                                                  ││
│ │ [对话]  │ │  ┌────────────────────────────────────────────┐ ││
│ │ [任务]  │ │  │ User: 帮我生成今天的日报                    │ ││
│ │ [日程]  │ │  └────────────────────────────────────────────┘ ││
│ │ [文件]  │ │                                                  ││
│ │ [插件]  │ │  ┌────────────────────────────────────────────┐ ││
│ │ [设置]  │ │  │ AI: 好的，正在从多个数据源汇总信息...        │ ││
│ │         │ │  │     [████████░░░░░░░░] 60%                  │ ││
│ │         │ │  │     ✓ Slack消息汇总                        │ ││
│ │         │ │  │     → 正在提取邮件摘要                      │ ││
│ │         │ │  │     ○ 整理并生成报告                        │ ││
│ │         │ │  └────────────────────────────────────────────┘ ││
│ └─────────┘ └─────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│ [接管] [暂停] [停止]           定时任务: 今日已执行 3/5          │
├─────────────────────────────────────────────────────────────────┤
│ 输入框: ___________________________________________ [发送]    │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 任务面板

```
┌─────────────────────────────────────────────────────────────────┐
│  任务列表                              [+ 新建定时任务]         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔄 执行中                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 📊 生成日报                             60%  [暂停] [停止]   ││
│  │ 正在从邮件提取信息...                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ⏰ 今日定时任务                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 📧 邮件摘要        09:00  ✓ 已完成    [查看结果] [重新执行]  ││
│  │ 📊 日报生成        09:30  🔄 执行中   [查看结果]            ││
│  │ 📁 文件整理        23:00  ⏳ 待执行                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ✅ 最近完成                                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🎯 竞品监控        昨天 10:00  ✓ 成功     [查看结果]        ││
│  │ 📋 周报生成        周五 18:00  ✓ 成功     [查看结果]        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 定时任务创建

```
┌─────────────────────────────────────────────────────────────────┐
│  创建定时任务                                              [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  任务名称: [每日早报________________________]                    │
│                                                                 │
│  任务描述:                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 从邮件、日历、Slack汇总昨天的工作，生成日报并发送给我的团队  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  执行时间:                                                       │
│  ○ 每天 [09:00▼]                                                │
│  ○ 每周 [周五▼] [18:00▼]                                        │
│  ○ 自定义  [0 9 * * *▼] (Cron表达式)                            │
│                                                                 │
│  执行设备: ○ 任意  ○ 桌面  ○ 手机                               │
│                                                                 │
│  通知设置:                                                       │
│  ☑ 执行开始时通知  ☑ 执行完成时通知  ☑ 执行失败时通知          │
│  通知方式: ☑ App  ☑ Email                                       │
│                                                                 │
│                         [取消]          [创建任务]               │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 手机端界面

```
┌─────────────────────┐
│  OpenCowork    [≡]  │
├─────────────────────┤
│                     │
│  🔄 进行中的任务     │
│  ┌─────────────────┐│
│  │ 📊 日报生成     ││
│  │ 60% - 提取邮件 ││
│  │ [接管] [停止]   ││
│  └─────────────────┘│
│                     │
│  ⏰ 今日日程        │
│  ┌─────────────────┐│
│  │ 09:00 邮件摘要  ││
│  │ 09:30 日报生成  ││
│  │ 23:00 文件整理  ││
│  └─────────────────┘│
│                     │
│  ┌─────────────────┐│
│  │ + 发送新任务    ││
│  └─────────────────┘│
│                     │
├─────────────────────┤
│ [对话] [任务] [日程] │
└─────────────────────┘
```

### 8.5 设计规范

#### 配色方案

| 类别         | 颜色    | 用途     |
| ------------ | ------- | -------- |
| Primary      | #6366F1 | 主色调   |
| Secondary    | #8B5CF6 | 辅助色   |
| Accent       | #22D3EE | 强调色   |
| Background   | #0F0F14 | 深色背景 |
| Surface      | #1A1A24 | 卡片背景 |
| Text Primary | #FFFFFF | 主文字   |
| Success      | #10B981 | 成功状态 |
| Warning      | #F59E0B | 警告状态 |
| Error        | #EF4444 | 错误状态 |

#### 组件规范

| 组件     | 样式                       |
| -------- | -------------------------- |
| 聊天气泡 | 圆角20px，悬停发光效果     |
| 按钮     | 圆角12px，支持loading状态  |
| 输入框   | 毛玻璃背景，聚焦时渐变边框 |
| 任务卡片 | 悬停上浮+阴影，状态指示器  |
| 进度条   | 渐变填充，带脉冲动画       |

### 8.6 浏览器预览模块

#### 8.6.1 功能概述

浏览器预览模块让用户**实时观看AI操作浏览器的过程**，区别于截图更新，实现真正的实时画面投射。

| 特性     | 说明                                                    |
| -------- | ------------------------------------------------------- |
| 实时观看 | BrowserView嵌入，画面<50ms延迟                          |
| 三种模式 | 侧边预览 / 可折叠 / 独立窗口                            |
| 模式切换 | 一键切换，用户可随时改变预览方式                        |
| 接管控制 | 观看时可随时接管，切换为用户操作                        |
| 可关闭   | 用户可关闭预览（点击[×]），任务继续执行，仅隐藏预览视图 |
| 可配置   | 预览尺寸可在设置中自定义（侧边宽度、窗口大小等）        |

#### 8.6.2 侧边预览模式（默认）

```
┌─────────────────────────────────────────────────────────────┐
│  OpenCowork                              [─] [□] [×]       │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────┬─────────────────────────────────────────────┐   │
│ │         │ [👁️ 侧边] [📱 窗口] [🔲 折叠]  [接管] [×] │   │
│ │ 聊天区域 │─────────────────────────────────────────────│   │
│ │         │                                              │   │
│ │ AI正在.. │   🔍 AI Browser Preview                      │   │
│ │         │   ┌────────────────────────────────────┐    │   │
│ │ ✓ 已完成 │   │                                    │    │   │
│ │ → 正在.. │   │    [携程网页面 - 实时画面]          │    │   │
│ │         │   │    🔴 AI正在点击"北京"输入框          │    │   │
│ │         │   │                                    │    │   │
│ │         │   └────────────────────────────────────┘    │   │
│ │         │   URL: www.ctrip.com                        │   │
│ │         │   操作: browser:click @ #fromCity           │   │
│ └─────────┴─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ [接管] [暂停] [停止]                    定时任务: 今日 3/5  │
└─────────────────────────────────────────────────────────────┘
```

**特点**：

- 默认启用，占用主窗口右侧500px
- 与聊天区域并列，信息集中
- 实时显示AI操作的每一个步骤

#### 8.6.3 可折叠预览模式

```
收起状态（默认）:
┌─────────────────────────────────────────────────────────────┐
│ [👁️ 侧边] [📱 窗口] [🔲 折叠]   [点击展开预览]    [接管]  │
└─────────────────────────────────────────────────────────────┘

展开状态:
┌─────────────────────────────────────────────────────────────┐
│ [👁️ 侧边] [📱 窗口] [🔲 折叠]         [收起]      [接管]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  [携程网页面 - 实时画面]                             │   │
│   │  🔴 AI正在点击"北京"输入框                            │   │
│   │                                                       │   │
│   │  URL: www.ctrip.com                                  │   │
│   │  操作: browser:click @ #fromCity                      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   主聊天区域...                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**特点**：

- 默认收起，只显示40px高的标签栏
- 点击标签栏展开预览区域
- 展开时占屏幕60%高度
- 适合需要更多聊天空间时

#### 8.6.4 独立窗口模式

```
独立浏览器预览窗口（可拖到副屏）:

┌─────────────────────────────────────────────┐
│  OpenCowork Preview            [─] [□] [×]  │
├─────────────────────────────────────────────┤
│ [👁️ 侧边] [📱 窗口] [🔲 折叠]    [接管]    │
├─────────────────────────────────────────────┤
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │                                      │   │
│   │   [携程网页面 - 实时画面]            │   │
│   │   🔴 AI正在点击"北京"输入框          │   │
│   │                                      │   │
│   │                                      │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   URL: www.ctrip.com                        │
│   操作: browser:click @ #fromCity           │
│                                             │
└─────────────────────────────────────────────┘

主窗口保持纯聊天界面
┌───────────────────────────────┐
│ 聊天区域（无预览）            │
│                               │
│ AI正在操作独立预览窗口...     │
│ [切回侧边预览]               │
└───────────────────────────────┘
```

**特点**：

- 独立窗口，可拖到副屏或多显示器
- 主窗口只保留聊天界面
- 适合长时间任务，用户可在另一屏幕工作
- 关闭独立窗口自动切回侧边模式

#### 8.6.5 模式切换交互

| 操作         | 效果                           |
| ------------ | ------------------------------ |
| 点击模式按钮 | 立即切换到对应模式             |
| 点击"接管"   | 暂停AI操作，切换到用户控制模式 |
| ESC键        | 快速接管（观看模式下）         |
| 关闭预览面板 | 收起预览，保持任务执行         |

#### 8.6.6 观看模式 vs 接管模式

```typescript
enum PreviewMode {
  VIEWING = 'viewing', // 观看模式：AI操作，用户观看
  TAKEOVER = 'takeover', // 接管模式：用户操作，AI暂停
}

// 模式切换
function switchToViewingMode() {
  // 用户交还控制，AI继续执行
  taskEngine.resume();
  previewMode = 'viewing';
}

function switchToTakeoverMode() {
  // 用户接管，AI暂停
  taskEngine.pause();
  previewMode = 'takeover';

  // 用户可以手动操作浏览器
  // 操作完成后可选择：
  // [交还AI] - AI继续执行剩余步骤
  // [重新开始] - 清空上下文，重新规划
  // [人工完成] - 任务结束
}
```

#### 8.6.7 预览状态指示

```
实时状态栏:

┌─────────────────────────────────────────────────────────────┐
│ 🔍 正在观看 AI 操作                                         │
│                                                             │
│ 当前步骤: 2/6 - 点击"北京"输入框                            │
│ 执行动作: browser:click @ #fromCity                         │
│ 目标URL: www.ctrip.com/flights                              │
│                                                             │
│ [████████░░░░░░░░░] 30%                                    │
└─────────────────────────────────────────────────────────────┘
```

#### 8.6.8 典型场景：实时观看任务执行

```
场景: 用户让AI帮忙订机票

1. 用户在聊天框输入: "帮我订明天北京到上海的机票"
2. AI开始规划任务
3. AI打开携程网站 → 侧边预览显示携程页面
4. AI点击"出发地"输入框 → 预览显示点击位置高亮
5. AI输入"北京" → 预览实时显示输入内容
6. AI点击"目的地"输入框 → 预览显示点击
7. AI输入"上海" → 预览实时显示
8. AI选择日期 → 预览显示日期选择
9. AI点击搜索 → 预览显示搜索结果
10. AI提取价格列表 → 预览显示结果
11. AI整理成表格 → 生成Excel文件
12. 任务完成，通知用户

用户全程可以在侧边预览观看AI的每一个操作，也可以随时接管。
```

---

## 9. 非功能需求

### 9.1 性能要求

| 指标           | 要求          |
| -------------- | ------------- |
| 启动时间       | < 3s (冷启动) |
| 页面加载       | < 2s          |
| Action执行延迟 | < 500ms       |
| 任务规划延迟   | < 3s          |
| 并发任务       | ≥ 5           |
| 定时任务精度   | < 1min        |
| 多端同步延迟   | < 2s          |
| 内存占用       | < 1GB (空闲)  |

### 9.2 安全要求

| 安全项   | 要求                        |
| -------- | --------------------------- |
| 传输加密 | TLS 1.3                     |
| 本地存储 | 加密 (AES-256)              |
| API密钥  | 不存储明文                  |
| 沙箱隔离 | Browser Context + CLI白名单 |
| 操作审计 | 完整日志，可追溯            |
| 多端认证 | 设备配对+加密通道           |

### 9.3 兼容性

| 项目   | 要求                                  |
| ------ | ------------------------------------- |
| 桌面OS | Windows 10+, macOS 11+, Ubuntu 20.04+ |
| 移动OS | iOS 14+, Android 10+                  |
| 处理器 | x86_64 / ARM64                        |
| 内存   | ≥ 8GB RAM                             |
| 磁盘   | ≥ 500MB 可用空间                      |

### 9.4 可扩展性

| 维度          | 要求                 |
| ------------- | -------------------- |
| Executor扩展  | 支持新增Executor类型 |
| LLM扩展       | 支持新增LLM Provider |
| Connector扩展 | 支持新连接器开发     |
| Plugin扩展    | 支持第三方插件       |

---

## 10. 路线图

### 10.1 版本阶段

采用 **v0.1 → v0.3 → v0.4 → v0.5 → v0.6 → v0.7 → v1.0** 七阶段发布。

### 10.2 v0.1 (MVP)

**目标**: 验证核心产品方向

| 功能             | 周期     | 交付标准             |
| ---------------- | -------- | -------------------- |
| 基础浏览器自动化 | Week 1-4 | 打开网页、点击、输入 |
| 对话UI           | Week 3-6 | 基础聊天界面         |
| 独立窗口预览     | Week 4-6 | 独立浏览器预览窗口   |
| 人工接管(ESC)    | Week 5-8 | 快速接管机制         |
| CLI基础执行      | Week 6-8 | 白名单命令执行       |

**里程碑**: 内部测试版本

### 10.3 v0.3 (工业级Browser Agent架构)

> 详细技术规格请参考：[SPEC v0.3](./SPEC_v0.3.md)

**目标**: 实现工业级Browser Agent架构，提升任务成功率达到85-95%

| 功能                        | 周期     | 交付标准                                 |
| --------------------------- | -------- | ---------------------------------------- |
| **UIGraph语义层**           | Week 1-3 | DOM转换为语义化元素图谱，LLM只看到语义ID |
| **Observer观察者**          | Week 2-3 | 失败后捕获页面状态，获取完整UI图谱       |
| **Verifier验证层**          | Week 2-4 | 验证每步执行结果，及时发现失败           |
| **RecoveryEngine恢复引擎**  | Week 3-5 | LLM决策恢复策略，处理各类失败场景        |
| **ShortTermMemory短期记忆** | Week 4-5 | 记录成功/失败轨迹，用于学习优化          |
| **反爬虫机制文档化**        | Week 1-2 | 记录现有反爬虫实现，分析已知弱点         |

**核心架构**: Observe → Decide → Act → Verify → Recovery → Memory

| 指标         | v0.2 | v0.3目标   |
| ------------ | ---- | ---------- |
| 任务成功率   | ~65% | **85-95%** |
| 点击准确率   | ~80% | **>95%**   |
| 失败后恢复率 | ~50% | **>80%**   |

**里程碑**: 工业级Browser Agent版本

### 10.4 v0.4 (LangChain/LangGraph重构)

> 详细技术规格请参考：[SPEC v0.4](./SPEC_v0.4.md)

**目标**: 全量采用 LangChain/LangGraph 替换现有架构，实现标准化 Agent 执行流程

| 功能                         | 周期       | 交付标准                      |
| ---------------------------- | ---------- | ----------------------------- |
| **LangChain/LangGraph 引入** | Week 1-2   | 依赖安装、StateSchema 设计    |
| **StateGraph 重构**          | Week 3-4   | Graph 搭建、基础 Nodes 实现   |
| **Browser/CLI Tools 封装**   | Week 5-6   | LangChain Tool 封装现有执行器 |
| **Checkpointer 持久化**      | Week 7-8   | SQLite 持久化、任务可恢复     |
| **Memory Store 集成**        | Week 9-10  | 跨会话记忆、语义搜索          |
| **Vision Tool 封装**         | Week 11-12 | OCR、图表解析 Tool 封装       |
| **LangSmith 集成**           | Week 13-14 | 可观测性、运行时追踪          |
| **测试与优化**               | Week 15-16 | E2E 测试、性能优化            |

**核心变化**:

- 删除: TaskEngine, PlanExecutor, TaskPlanner, RecoveryEngine, ShortTermMemory, UIGraph, Observer
- 新增: GraphAgent, Nodes (planner/executor/verify/memory), Tools (browser/cli/vision)
- 持久化: 内置 Durable Execution
- 记忆: Memory Store 替代 ShortTermMemory

| 指标       | v0.3   | v0.4 目标                  |
| ---------- | ------ | -------------------------- |
| 任务成功率 | 85-95% | **90-98%**                 |
| 代码复用   | -      | **+40%** (复用 LangGraph)  |
| 恢复能力   | 手动   | **内置** Durable Execution |
| 可观测性   | 手动   | **LangSmith** 集成         |

**里程碑**: LangChain 架构版本

### 10.5 v0.5 (功能完备)

**目标**: 完善功能 + 任务历史 + 白名单配置

| 功能             | 周期       | 交付标准           |
| ---------------- | ---------- | ------------------ |
| **任务历史记录** | Week 17-20 | 执行历史、结果保存 |
| **白名单配置UI** | Week 18-22 | 可视化配置界面     |
| **Skill系统**    | Week 21-24 | SKILL.md规范支持   |

**里程碑**: 功能完备版本

### 10.6 v0.6 (定时任务)

**目标**: 定时任务系统 + 调度优化

| 功能             | 周期       | 交付标准           |
| ---------------- | ---------- | ------------------ |
| **定时任务核心** | Week 25-26 | Cron调度、持久化   |
| **任务队列**     | Week 27-28 | 重试机制、并发控制 |
| **UI 集成**      | Week 29-30 | 任务面板、Cron配置 |

**技术选型**:

- 任务调度: node-cron (无 Redis 依赖)
- 持久化: 复用 TaskHistory SQLite
- 时区: 系统本地时区

**里程碑**: 定时任务版本

### 10.7 v0.7 (多端协同)

**目标**: 飞书机器人手机端 + 桌面端协同 + 插件生态

| 功能          | 周期       | 交付标准              |
| ------------- | ---------- | --------------------- |
| 飞书机器人    | Week 29-30 | 消息接收、基础回复    |
| 任务转发      | Week 29-30 | 飞书消息→桌面端       |
| 结果推送      | Week 31-32 | 企业消息订阅主动推送  |
| 状态查询      | Week 31-32 | 状态/列表命令         |
| 进度推送      | Week 33    | 执行进度通知          |
| 接管控制      | Week 33-34 | 手机接管/交还桌面任务 |
| 对话式交互    | Week 33-34 | 多轮对话状态机        |
| 飞书Connector | Week 34-36 | 飞书消息读写/通知     |
| 基础Connector | Week 34-36 | Slack/GitHub连接器    |
| 操作审计      | Week 37-38 | 完整审计日志          |

**技术选型**:

- 手机端: 飞书机器人（非独立 App）
- 消息推送: 企业消息订阅（主动推送）
- IM 抽象: 接口预留（支持未来钉钉/企业微信）

**里程碑**: Beta测试版本

### 10.8 v1.0 (正式版)

**目标**: 可发布给早期用户

| 功能         | 周期       | 交付标准             |
| ------------ | ---------- | -------------------- |
| 企业安全增强 | Week 25-28 | Admin控制、SSO集成   |
| API完善      | Week 25-28 | RESTful API、SDK     |
| 插件市场     | Week 27-30 | 官方插件分发         |
| 性能优化     | Week 29-32 | 启动、响应速度优化   |
| 文档完善     | Week 31-34 | 开发者文档、用户指南 |

**里程碑**: 正式发布版本

### 10.9 未来规划

| 版本 | 目标     | 功能点                     |
| ---- | -------- | -------------------------- |
| v1.1 | 体验优化 | UI改进、Bug修复            |
| v1.2 | 生态建设 | 插件市场、更多Connector    |
| v2.0 | 企业版   | 私有部署、HA集群、高级合规 |

---

## 11. 附录

### 11.1 术语表

| 术语         | 英文         | 定义                      |
| ------------ | ------------ | ------------------------- |
| OpenCowork   | OpenCowork   | AI原生桌面助手产品名称    |
| Dispatch     | Dispatch     | 多端协同、任务分发系统    |
| Scheduler    | Scheduler    | 定时任务调度系统          |
| Skill        | Skill        | Prompt模板+工具的技能封装 |
| Connector    | Connector    | 外部工具连接器            |
| Computer Use | Computer Use | AI像人类一样操作计算机    |
| Action Layer | Action Layer | 统一动作描述和路由层      |

### 11.2 参考资料

| 资料           | 说明          |
| -------------- | ------------- |
| Claude Cowork  | 产品参考      |
| Puppeteer Docs | Browser自动化 |
| Electron Docs  | 桌面应用框架  |
| BullMQ         | 任务队列      |
| node-cron      | Cron调度      |

### 11.3 技术选型理由

| 技术             | 选择理由        |
| ---------------- | --------------- |
| Electron + Tauri | 跨平台桌面框架  |
| TypeScript       | 类型安全        |
| 自研Runtime      | 不依赖LangChain |
| Socket.IO        | 实时通信        |
| BullMQ           | 可靠的任务队列  |
| SQLite           | 本地轻量数据库  |

---

## 文档历史

| 版本 | 日期       | 修改内容                                                                                                                                                                                                                                                                           |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0 | 2026-03-25 | 初始PRD，AI Browser定位                                                                                                                                                                                                                                                            |
| v2.0 | 2026-03-27 | 重大更新：<br>- 新增产品名称OpenCowork<br>- 新增多端协同Dispatch系统<br>- 新增定时任务调度系统<br>- 借鉴Claude Cowork的Plugins生态<br>- 借鉴Cowork的安全和权限设计<br>- 调整技术架构<br>- 更新路线图                                                                               |
| v2.1 | 2026-03-27 | 新增浏览器预览模块：<br>- 新增3.6节PreviewManager技术架构<br>- 新增8.6节浏览器预览模块UI设计<br>- 新增场景4：实时观看浏览器操作<br>- 更新7.4节接管机制（观看模式/接管模式）<br>- 更新路线图（v0.1独立窗口→v0.3侧边预览→v0.5可折叠）                                                |
| v2.2 | 2026-03-27 | PRD评审修复：<br>- 修复代码重复问题（TakeoverResult/TakeoverOption）<br>- 添加isExpanded属性声明<br>- 添加PreviewConfig配置接口，替代硬编码尺寸<br>- 细化画面同步技术描述（CDP会话绑定）<br>- 简化模块结构为方法模式<br>- 补充控制栏[×]关闭按钮说明<br>- 补充预览可关闭/可配置特性 |
| v2.5 | 2026-03-30 | v0.4 LangGraph重构架构确认：<br>- createReactAgent 代替完整 StateGraph（已确认）<br>- agentLogger 代替 LangSmith（已确认）<br>- MemorySaver 代替 SQLite Checkpointer（已确认）                                                                                                     |
| v2.8 | 2026-03-31 | v0.7 飞书机器人方案确认：<br>- 飞书机器人替代独立Mobile App<br>- 企业消息订阅实现主动推送<br>- IM抽象接口预留（支持未来钉钉/企业微信）<br>- Week 29-38 详细实施计划                                                                                                                |

---

## 12. v0.4 架构变更确认

> 更新日期: 2026-03-30

以下架构变更经评估后确认为正确调整，特此记录。

### 12.1 变更 1: createReactAgent 代替完整 StateGraph

| 项目 | 原始规划               | 实际实现                      | 状态      |
| ---- | ---------------------- | ----------------------------- | --------- |
| 架构 | StateGraph Nodes/Edges | `createReactAgent` (Prebuilt) | ✅ 已确认 |

**评估结论**：使用预建 Agent 降低复杂度，更快落地，后续可按需扩展。

### 12.2 变更 2: agentLogger 代替 LangSmith

| 项目     | 原始规划       | 实际实现                  | 状态      |
| -------- | -------------- | ------------------------- | --------- |
| 可观测性 | LangSmith 集成 | `agentLogger.ts` 本地日志 | ✅ 已确认 |

**评估结论**：本地日志更轻量，无需外部注册，适合桌面应用场景。

### 12.3 变更 3: MemorySaver 代替 SQLite Checkpointer

| 项目   | 原始规划            | 实际实现                   | 状态      |
| ------ | ------------------- | -------------------------- | --------- |
| 持久化 | SQLite Checkpointer | `MemorySaver` Checkpointer | ✅ 已确认 |

**评估结论**：内存存储配置简单，SQLite 可在后续按需引入。

---

## 13. v0.6 定时任务系统详细规划

> 更新日期: 2026-03-30

### 13.1 技术方案

| 项目     | 原 PRD 规划         | 调整后                  | 理由                         |
| -------- | ------------------- | ----------------------- | ---------------------------- |
| 任务队列 | BullMQ (需要 Redis) | node-cron + 内存队列    | 桌面应用无需分布式，简化依赖 |
| 持久化   | 新建                | 复用 TaskHistory SQLite | 避免重复建设                 |
| 时区     | 未明确              | 系统本地时区            | 简化设计，单用户场景足够     |

### 13.2 核心模块结构

```
src/scheduler/
├── scheduler.ts           # 调度器主类
├── cronParser.ts         # Cron 表达式解析
├── taskQueue.ts          # 任务队列 (内存)
├── taskStore.ts          # 定时任务持久化 (复用 SQLite)
└── types.ts              # 类型定义
```

### 13.3 定时任务数据模型

```typescript
interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  enabled: boolean;

  // 调度配置
  schedule: {
    type: 'cron' | 'interval' | 'one-time';
    cron?: string; // Cron 表达式 (本地时区)
    intervalMs?: number; // 间隔 (毫秒)
    startTime?: number; // 一次性任务开始时间
  };

  // 执行配置
  execution: {
    taskDescription: string; // 实际执行的任务描述
    timeout: number; // 超时 (ms)
    maxRetries: number; // 最大重试次数
    retryDelayMs: number; // 重试间隔
  };

  // 状态
  lastRun?: number;
  nextRun?: number;
  lastStatus?: 'success' | 'failed' | 'cancelled';
  runCount: number;

  createdAt: number;
  updatedAt: number;
}
```

### 13.4 Cron 表达式配置 UI

```
执行时间配置:
┌─────────────────────────────────────────────────────────────┐
│ ○ 每天 [09:00▼]                                          │
│ ○ 每周 [周五▼] [18:00▼]                                 │
│ ○ 自定义 [0 9 * * *▼] ← 支持直接输入 Cron 表达式      │
│                                                             │
│ 常用表达式:                                                │
│   • 每天 9:00      → 0 9 * * *                          │
│   • 每周一 9:00   → 0 9 * * 1                           │
│   • 每月 1 日 9:00 → 0 9 1 * *                           │
│   • 每小时        → 0 * * * *                            │
└─────────────────────────────────────────────────────────────┘
```

### 13.5 定时任务列表 UI

```
┌─────────────────────────────────────────────────────────────┐
│  定时任务                                      [+ 新建]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🔄 执行中                                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📊 生成日报    下次: 今天 09:00  [暂停] [停止]        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ⏰ 待执行                                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📁 文件整理    下次: 今天 23:00  [启用]               ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ✅ 最近执行 (5次)                                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📧 邮件摘要    昨天 09:00  ✓ 成功     [查看] [重试]  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 13.6 实施计划

| 周次    | 里程碑   | 任务                             | 交付物                        |
| ------- | -------- | -------------------------------- | ----------------------------- |
| Week 25 | 核心调度 | CronParser, TaskStore, Scheduler | 定时触发、持久化              |
| Week 26 |          | 定时触发机制                     | 任务可到期自动执行            |
| Week 27 | 队列系统 | TaskQueue, 重试机制              | 失败重试、exponential backoff |
| Week 28 |          | 并发控制                         | 限制同时执行任务数            |
| Week 29 | UI 集成  | 定时任务面板                     | 创建/编辑/删除/启用/禁用      |
| Week 30 | 完成     | Cron 配置 UI, TaskHistory 集成   | 完整定时任务功能              |

### 13.7 与现有系统集成

| 系统         | 集成点       | 方式                              |
| ------------ | ------------ | --------------------------------- |
| TaskHistory  | 执行记录写入 | 定时任务执行结果自动记录          |
| Skill System | 任务描述执行 | 定时任务通过 Skill 执行复杂任务   |
| LLM          | 任务规划     | 复用现有 TaskPlanner 进行任务分解 |
| UI           | 任务面板     | 新增定时任务 Tab 页               |

### 13.8 依赖

```json
{
  "dependencies": {
    "node-cron": "^3.0.0"
  }
}
```

---

## 14. v0.7 飞书机器人详细规划

> 更新日期: 2026-03-31

### 14.1 版本目标

飞书机器人作为手机端入口，实现多端协同。

### 14.2 功能清单

| 功能          | Week  | 说明                  |
| ------------- | ----- | --------------------- |
| 飞书机器人    | 29-30 | 消息接收、基础回复    |
| 任务转发      | 29-30 | 飞书消息→桌面端       |
| 结果推送      | 31-32 | 企业消息订阅主动推送  |
| 状态查询      | 31-32 | 状态/列表命令         |
| 进度推送      | 33    | 执行进度通知          |
| 接管控制      | 33-34 | 手机接管/交还桌面任务 |
| 对话式交互    | 33-34 | 多轮对话状态机        |
| 飞书Connector | 34-36 | 飞书消息读写/通知     |
| 基础Connector | 34-36 | Slack/GitHub连接器    |
| 操作审计      | 37-38 | 完整审计日志          |

### 14.3 飞书机器人实现

#### 14.3.1 消息接收

- 飞书开放平台 → 自建应用 → 机器人
- 接收用户@消息，解析任务描述
- 验证消息签名

#### 14.3.2 任务转发

- 用户消息 → OpenCowork Service → Desktop TaskEngine
- 异步处理（消息队列）
- 任务ID回传

#### 14.3.3 结果推送

- 企业消息订阅 → 主动推送
- 卡片消息展示结果

### 14.4 架构设计

```
┌─────────────────┐         ┌─────────────────┐
│   飞书 App      │         │   Desktop App   │
│                 │         │                 │
│  • @机器人发送 │◄──────►│  • 任务执行    │
│  • 接收卡片    │ HTTPS   │  • Browser执行  │
│  • 推送进度   │Webhook  │  • 结果回传     │
└─────────────────┘         └─────────────────┘
        │                            │
        └──────────┬────────────────┘
                   ▼
         ┌─────────────────┐
         │  Feishu Bot    │
         │  Service       │
         │  (消息队列)    │
         └─────────────────┘
```

### 14.5 IM 抽象接口

```typescript
interface IMBot {
  platform: 'feishu' | 'dingtalk' | 'wecom';
  onMessage(handler: (msg: IMMessage) => void): void;
  pushMessage(userId: string, message: IMMessage): Promise<void>;
  pushNotification(userId: string, notification: IMNotification): Promise<void>;
  bindUser(imUserId: string, desktopUserId: string): Promise<void>;
}
```

### 14.6 依赖

```json
{
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

---

_本文档最终解释权归产品团队所有_
