# OpenCowork 产品需求文档 (PRD)

| 项目         | 内容                                                                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 产品名称     | OpenCowork                                                                                                                                                                   |
| 文档版本     | v7.0                                                                                                                                                                         |
| 更新日期     | 2026-05-02                                                                                                                                                                   |
| 文档状态     | v4.0/v5.0/v6.0/v7.0 规划中；v0.12.x 进入桌面 AI 工作系统与 Agent Runtime 平台化收敛阶段                                                                                      |
| 基于竞品     | Claude Cowork + 原有AI Browser PRD                                                                                                                                           |
| 技术规格     | [SPEC v0.3](./SPEC_v0.3.md), [SPEC v0.4](./SPEC_v0.4.md), [SPEC v0.5](./SPEC_v0.5.md), [SPEC v0.6](./SPEC_v0.6.md), [SPEC P5](./SPEC_P5_agent-runtime-platformization.md)    |
| **部署场景** | **AI 专用设备**（安全限制放宽）                                                                                                                                              |
| **安全级别** | **内部信任环境**（非公开部署）                                                                                                                                               |

---

## 目录

1. [产品概述](#1-产品概述)
2. [核心功能](#2-核心功能)
3. [技术架构](#3-技术架构)
   - [3.7 工业级Browser Agent架构 (v0.3)](#37-工业级browser-agent架构-v03)
4. [多端协同系统](#4-多端协同系统-飞书机器人)
5. [版本规划](#5-版本规划)
6. [插件与生态](#6-插件与生态)
7. [安全与权限](#7-安全与权限)
8. [用户交互设计](#8-用户交互设计)
   - [8.6 浏览器预览模块](#86-浏览器预览模块)
9. [非功能需求](#9-非功能需求)
10. [路线图](#10-路线图)
11. [附录](#11-附录)
12. [PRD 7.0 版本规划](#21-prd-70-版本规划v014)

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

### 1.7 当前实现进展

当前版本已经完成 `v0.10.x` 基础设施收敛的主要目标，已具备：

- 统一任务模型：`TaskRun`、`TaskResult`、`TaskArtifact`、`TaskTemplate`
- 结果交付面板与结果导向历史
- 模板的保存、编辑、参数化运行
- 调度任务基于模板和参数执行
- IM 基于模板和参数执行
- chat / scheduler / IM 第一阶段统一编排
- result / history / task-run 视图已经统一展示 `executionTarget` 与 `actionContract`，并对历史数据做了归一化处理

因此，后续重点将逐步从“打基础”转向：

1. 继续收口统一编排与持久化
2. 强化 `v0.11` 的结果交付体验
3. 强化 `v0.12` 的模板与多入口自动化复用

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

### 4.7 IM配置面板

> v0.9 新增功能

#### 4.7.1 功能概述

通过图形界面配置IM平台集成，无需手动编辑JSON配置文件。

#### 4.7.2 与现有配置文件的关系

| 方式                          | 难度 | 适用用户 |
| ----------------------------- | ---- | -------- |
| 手动编辑 `config/feishu.json` | 高   | 开发者   |
| **IMConfigPanel UI配置**      | 低   | 所有用户 |

#### 4.7.3 支持平台

| 平台     | 支持版本 | 配置项                      |
| -------- | -------- | --------------------------- |
| 飞书     | v0.9+    | appId, appSecret            |
| 钉钉     | 规划中   | appKey, appSecret           |
| 企业微信 | 规划中   | corpId, agentId, corpSecret |
| Slack    | 规划中   | botToken, signingSecret     |

#### 4.7.4 配置流程

```
1. 打开 IM配置面板 (ControlBar → IM按钮)
2. 选择目标平台 Tab
3. 填写配置信息
4. 点击"测试连接"验证
5. 点击"保存"应用配置
6. 系统自动重连IM服务
```

#### 4.7.5 回退机制

当IM配置错误导致服务启动失败时：

1. 自动回退到之前的有效配置
2. 显示错误信息
3. 保持应用正常运行

#### 4.7.6 长连接通信架构（飞书）

飞书SDK支持基于WebSocket的长连接事件回调，桌面应用可直接接收回调，**无需公网服务器**：

```
┌─────────────────┐         wss://open.feishu.cn          ┌─────────────────┐
│  Desktop App    │◄───────────────────────────────►│   飞书开放平台   │
│                 │         长连接（加密）            │                  │
│  WSClient       │                                 │  • 消息事件      │
│  + EventHandler │                                 │  • 卡片交互      │
└─────────────────┘                                 └─────────────────┘
```

**长连接 vs Webhook 对比**：

| 对比项        | Webhook模式 | 长连接模式 |
| ------------- | ----------- | ---------- |
| 公网服务器    | 必须        | 不需要     |
| 回调URL配置   | 必须        | 不需要     |
| 加密/签名验证 | 需自行实现  | SDK内置    |
| 防火墙配置    | 需要        | 不需要     |
| 内网穿透工具  | 需要        | 不需要     |
| 开发周期      | 1周         | 5分钟      |

**技术实现**：

- 使用 `@larksuiteoapi/node-sdk` 的 `WSClient`
- 应用只需能访问公网（无需暴露端口）
- 内置通信加密和身份认证

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

## 5. 版本规划

### 5.1 P0：Hybrid CUA 基础能力

#### 版本目标

建立 OpenCowork 的浏览器视觉执行基础设施，形成 `DOM-first + CUA fallback` 的最小可用能力，同时保持底层模型接口兼容性，不锁定单一厂商的 API 形态。

详细技术规格见：`docs/SPEC_P0_hybrid-cua-foundation.md`

#### 核心价值

- 让系统第一次具备“看界面并操作网页”的能力
- 补足传统 selector/DOM 自动化在复杂前端场景中的短板
- 为后续恢复、模板化、调度复用打下统一运行时基础

#### 规划内容

- 建立统一的视觉执行协议 `VisualModelAdapter`
- 同时兼容 `Responses API` 与 `Chat Completions API`
- 建立浏览器内 `ComputerUseRuntime`
- 支持基础视觉动作：点击、输入、滚动、等待、截图、按键、拖拽
- 接入现有 BrowserExecutor / Playwright 运行时
- 建立最小版 `HybridToolRouter`
- 建立最小版高风险动作确认机制
- 建立基础 trace 与 metrics

#### 技术范围

- 仅覆盖浏览器内 Hybrid CUA MVP，不进入桌面级 VM 或操作系统控制
- 复用现有 BrowserExecutor / Playwright / CDP 运行时，不重写整套浏览器执行内核
- 以统一视觉协议为中心，同时兼容 `Responses API` 与 `Chat Completions API`
- 支持最小动作集合：点击、双击、输入、按键、滚动、等待、拖拽、截图
- 支持 `DOM fail -> CUA fallback`，但暂不实现复杂多轮恢复编排

#### 典型用户场景

- 登录后业务系统中的复杂菜单点击与表单输入
- 选择器不稳定页面中的一次性浏览器操作
- 用户明确要求“像人一样操作网页”的任务
- 重前端站点中简单但视觉依赖较高的流程

#### 用户可见变化

- 浏览器任务新增视觉执行模式
- Agent 可显式选择视觉浏览器路径处理复杂网页任务，而不只在 DOM 失败后回退
- 执行界面可显示当前运行模式为 DOM、CUA 或 fallback
- 高风险动作会暂停并请求用户确认
- 执行日志中开始出现视觉回合、截图请求和动作轨迹

#### 本版不包含

- 桌面级 computer use
- 自动模板沉淀
- 多 provider 动态最优选路
- 行业 workflow 包
- 大规模截图历史归档

#### 交付标准

- 双 API 路径都可运行视觉任务
- 浏览器内复杂页面可完成基础操作
- DOM 路径失败后可切换到 CUA fallback
- 有可观测执行日志与关键指标

#### 成功指标

| 指标 | 目标 |
| --- | --- |
| 支持视觉动作类型 | >= 8 类 |
| CUA 浏览器任务 MVP | 可用 |
| DOM -> CUA fallback | 可用 |
| 双 adapter 路径 | 可独立运行 |

### 5.2 P1：Hybrid 执行与恢复增强

#### 版本目标

把 CUA 从“可运行”提升到“可恢复、可确认、可接管”的稳定执行能力，重点提升复杂网页、企业后台和重前端系统中的任务完成率。

详细技术规格见：`docs/SPEC_P1_hybrid-recovery-and-approval.md`

#### 核心价值

- 提高复杂前端任务成功率
- 降低 selector 失效、弹窗、异步页面带来的失败率
- 形成“AI 自动执行 + 用户关键确认 + 接管恢复”的协作体验

#### 规划内容

- 完善 `HybridToolRouter` 路由策略
- 正式实现 `DOM-first + visual fallback`
- 建立 `Visual Recovery Mode`
- 增强动作后的视觉验证能力
- 统一纳入高风险动作确认：
  - 登录最终提交
  - 发布 / 发送
  - 删除 / 覆盖
  - 支付 / 下单
  - 权限授权
  - 文件上传
- 让 preview / takeover / approval 串成完整链路
- 建立 benchmark task 与评测体系

#### 技术范围

- 正式实现 `DOM-first + visual fallback` 路由策略
- 为 selector 失效、弹窗干扰、异步刷新、复杂菜单增加恢复策略
- 为视觉回合增加动作后验证与状态判断
- 将 approval / takeover 纳入统一执行链路
- 指标体系按 adapter 维度统计成功率、成本、延迟和接管率

#### 典型用户场景

- 低代码后台、SaaS 控制台、复杂运营工作台中的多步任务
- selector 连续失效后的视觉恢复
- 需要先确认再执行的发布、删除、提交类任务
- 用户在预览中临时接管，再交还 AI 继续执行

#### 用户可见变化

- 复杂页面任务成功率显著提升
- 对复杂前端、菜单、弹窗、低代码后台等场景，系统可更主动地使用视觉浏览器能力
- 失败时不再直接报错，而是自动尝试恢复
- 用户可在关键节点接管并恢复执行
- 待确认动作会以统一交互形式暴露给用户

#### 本版不包含

- 模板自动生成与模板中心深化
- 跨入口统一模板调度复用
- 行业化解决方案包
- 浏览器外本地应用自动化

#### 交付标准

- 复杂网页任务成功率显著高于 DOM-only
- selector 失败后可自动切换视觉恢复
- 高风险动作统一进入确认链路
- 用户接管后可继续执行并交还 AI

#### 成功指标

| 指标 | 目标 |
| --- | --- |
| Browser-first 复杂任务完成率 | 持续提升 |
| 失败恢复成功率 | 显著提升 |
| 高风险动作确认覆盖率 | 100% |
| 按 adapter 维度的评测数据 | 建立完成 |

### 5.3 P2：产品化复用与多入口统一

#### 版本目标

把 Hybrid CUA 能力从执行引擎升级为产品能力，使成功任务能够沉淀、复用、调度和跨入口运行，形成结果交付导向的 AI 工作系统。

详细技术规格见：`docs/SPEC_P2_templateization-and-multi-entry.md`

#### 核心价值

- 用户不必重复演示同一类复杂网页任务
- 首次完成后即可转为模板和自动化流程
- chat、scheduler、IM、MCP 共享同一套执行能力与结果模型

#### 规划内容

- 支持 `Replay to Template`
- 支持复杂任务保存为参数化模板
- 支持成功流程沉淀为 Skill 候选
- Scheduler 复用 Hybrid runtime
- IM 远程触发复用 Hybrid runtime
- MCP 外部触发复用 Hybrid runtime
- 加强结果交付：摘要、表格、文件、页面链接、截图证据
- 强化 Result-first UX：sidebar、history、IM 回传、rerun flows

#### 技术范围

- 基于统一 `TaskRun / TaskResult / Template / Artifact` 模型进行产品化复用
- 支持将成功任务保存为模板，并通过参数重新运行
- Scheduler、IM、MCP 统一消费同一套 Hybrid runtime
- 结果、证据与产物进入统一历史和侧边栏结果交付链路
- 允许成功流程沉淀为 Skill 候选，但不要求完全自动发布到市场

#### 典型用户场景

- 将复杂网页操作保存为可复跑模板
- 定时报表、巡检、竞品监控等重复任务
- 飞书远程下发任务，桌面执行后自动回传结果
- 外部系统通过 MCP 调用浏览器工作流

#### 用户可见变化

- 成功任务可直接保存为模板
- 模板支持参数化复跑与调度
- 结果面板更加面向交付物，而不仅是日志
- IM、scheduler、chat 运行结果更加一致

#### 本版不包含

- 真正的多模型自动最优路由
- 桌面级跨应用自动化
- 完整的行业市场化模板分发体系

#### 交付标准

- 复杂网页任务可保存为模板
- 模板支持参数化复跑
- 调度、IM、MCP 可直接运行 Hybrid 模板任务
- 结果交付明显优于单纯执行日志展示

#### 成功指标

| 指标 | 目标 |
| --- | --- |
| 模板复用率 | 提升 |
| 多入口运行一致性 | 提升 |
| 结果交付完整度 | 提升 |
| 成功任务沉淀为模板 / Skill 的比例 | 提升 |

### 5.4 P3：平台化与生态扩展

#### 版本目标

把 OpenCowork 打造成模型无关、入口无关、场景可扩展的 Browser-first Hybrid CUA 平台，形成长期的技术与产品壁垒。

详细技术规格见：`docs/SPEC_P3_platformization-and-ecosystem.md`

#### 核心价值

- 不被单一模型 API 或单一厂商锁定
- 让 CUA 成为平台级基础能力，而不是单点特性
- 形成可扩展的行业化自动化与开放生态能力

#### 规划内容

- 建立 provider-aware routing
- 按成功率、成本、延迟选择最佳视觉后端
- 建立 capability registry
- 支持多模型、多视觉后端适配
- 提供行业场景包：
  - 电商后台
  - SaaS 运维后台
  - 运营工作台
  - 数据采集 / 填报
  - 首批以官方 workflow packs 形式提供，并支持安装为 Templates
- 启动桌面级 computer use 扩展验证
- 结合 Templates、Skills 与 MCP 构建开放生态

#### 技术范围

- 建立 provider-aware routing，依据成功率、成本、延迟进行视觉后端选择
- 引入 capability registry，统一抽象不同模型和视觉后端能力
- 让上层任务、模板、结果系统不感知底层 API 形态差异
- 为桌面级 computer use 建立验证边界，优先验证本地应用、文件系统工作流和跨应用流程的可行性
- 为行业场景包与开放生态建立标准化接入契约
- 行业场景包优先沉淀为 browser-heavy 官方 workflow packs，供用户直接安装和复用

#### 典型用户场景

- 同一任务按环境切换不同模型或视觉后端执行
- 标准行业后台 workflow 的开箱即用复用
- 官方 workflow packs 一键安装后在 Templates 中直接运行与调度
- 浏览器与本地应用联合完成办公流程的验证版场景
- 外部生态基于 Templates、Skills、MCP 构建扩展能力

#### 用户可见变化

- 用户无需感知底层模型差异，即可获得稳定任务完成体验
- 提供行业模板、行业流程和更高层次自动化能力
- 提供可安装的官方 workflow packs，降低行业流程复用门槛
- 浏览器自动化开始具备向桌面工作流扩展的验证能力

#### 本版不包含

- 正式的桌面级 computer use 产品化交付
- 面向所有桌面应用的统一支持
- 无统一的大版本边界，但将按行业场景、provider 接入和桌面级扩展逐步分批落地

#### 交付标准

- 上层产品不感知底层模型接口差异
- 不同视觉 adapter 可互换
- 行业化 workflow 包初步可用
- 官方 workflow packs 可安装、可复用、可进入模板运行链路
- 启动桌面级扩展验证

#### 成功指标

| 指标 | 目标 |
| --- | --- |
| 多视觉后端接入 | 完成 |
| 适配器可替换性 | 达成 |
| 行业模板 / 场景包 | 初步建立 |
| 平台级复用能力 | 成熟 |

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

### 10.9 v0.8 (WebFetch + 工具增强)

> 更新日期: 2026-04-02

**目标**: 轻量级HTTP工具 + Exa AI搜索集成，为企业数据采集场景提供基础能力

| 功能                | 周期       | 交付标准                   | 优先级 |
| ------------------- | ---------- | -------------------------- | ------ |
| **WebFetch 工具**   | Week 39-40 | 基础HTTP GET/POST + UA重试 | P0     |
| **WebSearch 集成**  | Week 40-41 | Exa AI搜索接入             | P0     |
| **Cookie/代理支持** | Week 41-42 | 高级配置选项               | P1     |
| **工具链完善**      | Week 42-43 | 文档 + 单元测试            | P1     |

#### 10.9.1 WebFetch Tool 功能规格

| 参数              | 类型    | 默认值     | 说明                                                |
| ----------------- | ------- | ---------- | --------------------------------------------------- |
| `url`             | string  | **必填**   | 目标URL                                             |
| `format`          | enum    | `markdown` | 返回格式：text / markdown / html                    |
| `timeout`         | number  | `30`       | 超时秒数，最大120                                   |
| `method`          | enum    | `GET`      | 请求方法：GET / POST / HEAD                         |
| `headers`         | object  | `{}`       | 自定义请求头                                        |
| `retryOnUAChange` | boolean | `true`     | Cloudflare拦截时UA重试                              |
| `redirect`        | enum    | `follow`   | follow(自动跟随) / error(报错) / manual(手动)       |
| `cookieJar`       | boolean | `true`     | 保持Cookie/Session                                  |
| `proxy`           | string  | `null`     | 代理地址，支持认证格式 `http://user:pass@host:port` |

#### 10.9.2 UA重试机制

```typescript
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
  'opencode/1.0',
];

// Cloudflare challenge 检测: response.status === 403 && headers.get('cf-mitigated') === 'challenge'
```

#### 10.9.3 返回结构

```typescript
interface WebFetchResult {
  title: string; // URL + Content-Type
  output: string; // 格式化内容
  metadata: {
    statusCode: number;
    contentType: string;
    contentLength: number;
    finalUA: string; // 最终使用的UA
    retryAttempted: boolean; // 是否进行了UA重试
    finalUrl: string; // 重定向后的最终URL
    headers: Record<string, string>;
  };
  attachments?: {
    // 图片时返回
    type: 'file';
    mime: string;
    url: string; // data:base64,xxx
  }[];
}
```

#### 10.9.4 技术选型

| 项目          | 选择                       | 理由                                    |
| ------------- | -------------------------- | --------------------------------------- |
| HTML→Markdown | turndown                   | OpenCode生产验证，GFM完整支持，开箱即用 |
| HTTP库        | 原生fetch                  | Node.js 18+ 原生支持，无需额外依赖      |
| 代理格式      | http://user:pass@host:port | 原生fetch直接支持                       |

#### 10.9.5 与浏览器工具对比

| 维度           | Browser工具      | WebFetch工具      |
| -------------- | ---------------- | ----------------- |
| 启动开销       | 大（完整浏览器） | 小（原生HTTP）    |
| 适用场景       | 网页操作、交互   | 数据采集、API调用 |
| 内容提取       | DOM解析          | HTML文本处理      |
| 速度           | 2-5s             | <1s               |
| JavaScript渲染 | 支持             | 不支持            |

**里程碑**: 工具完备版本

### 10.10 v0.9 (IM配置增强)

> 规划日期: 2026-04-06

**目标**: IM平台配置可视化，无需手动编辑配置文件

| 功能              | 周期    | 交付标准                 |
| ----------------- | ------- | ------------------------ |
| **IMConfigPanel** | Week 44 | 飞书/钉钉/企微配置UI     |
| 连接测试          | Week 44 | 一键测试连接状态         |
| 配置热更新        | Week 44 | 保存后自动重载服务       |
| 状态指示器        | Week 44 | ControlBar显示IM连接状态 |

**里程碑**: IM配置可视化版本

#### 10.10.1 功能概述

通过图形界面配置各IM平台集成，提供连接测试和状态监控功能。

#### 10.10.2 UI入口规格

| 入口       | 位置           | 说明               |
| ---------- | -------------- | ------------------ |
| IM配置按钮 | ControlBar右侧 | 带连接状态指示器   |
| 点击打开   | IMConfigPanel  | 弹窗形式配置各平台 |

#### 10.10.3 IMConfigPanel 组件规格

**布局结构**：

```
┌─────────────────────────────────────────────────────────────┐
│  IM 配置                                           [×]     │
├─────────────────────────────────────────────────────────────┤
│  [飞书] [钉钉] [企业微信] [Slack]  ← Tab切换               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ○ 启用 [平台名称] 集成                                     │
│                                                             │
│  App ID:     [cli_xxxxxxxxxxxxxxxxx          ]                │
│  App Secret: [●●●●●●●●●●●●●●●●●●●●●●●●●    ] [显示]        │
│                                                             │
│  状态: ● 已连接  ○ 未连接  ◐ 连接中                        │
│                                                             │
│  [测试连接]                              [保存]  [取消]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**配置项说明**：

| 平台     | 必填字段                    | 可选字段 | 特殊说明       |
| -------- | --------------------------- | -------- | -------------- |
| 飞书     | appId, appSecret            | -        | 长连接模式     |
| 钉钉     | appKey, appSecret           | -        | 企业内部应用   |
| 企业微信 | corpId, agentId, corpSecret | -        | 需配置应用权限 |
| Slack    | botToken, signingSecret     | -        | OAuth2.0认证   |

**长连接模式说明（飞书）**：

- 无需配置回调URL
- 无需验证Token和加密密钥
- 应用需能访问公网（无需暴露端口）
- SDK自动处理加密和身份认证

**组件交互**：

| 交互     | 行为                                   |
| -------- | -------------------------------------- |
| 启用开关 | 开启后显示完整表单                     |
| 测试连接 | 调用 `im:test` IPC，5秒超时，显示结果  |
| 保存     | 调用 `im:save` IPC，验证后保存并热更新 |
| 取消     | 关闭弹窗，不保存变更                   |
| Tab切换  | 切换平台，重置表单为该平台已保存配置   |

#### 10.10.4 技术实现

**IPC通信**：

| IPC方法     | 说明             | 参数                   |
| ----------- | ---------------- | ---------------------- |
| `im:load`   | 加载所有IM配置   | -                      |
| `im:save`   | 保存指定平台配置 | `{ platform, config }` |
| `im:test`   | 测试连接         | `{ platform, config }` |
| `im:status` | 获取连接状态     | `{ platform }`         |

**配置存储**：

| 文件         | 位置                   | 格式 |
| ------------ | ---------------------- | ---- |
| 飞书配置     | `config/feishu.json`   | JSON |
| 钉钉配置     | `config/dingtalk.json` | JSON |
| 企业微信配置 | `config/wecom.json`    | JSON |
| Slack配置    | `config/slack.json`    | JSON |

**服务热更新**：

```
用户保存配置
    ↓
im:save IPC
    ↓
验证配置格式
    ↓
写入 config/{platform}.json
    ↓
调用 IMService.reload(platform)
    ↓
更新连接状态
```

#### 10.10.5 依赖关系

```
IMConfigPanel.tsx (新组件)
    ├── config/imConfig.ts (新配置模块)
    ├── im/feishu/FeishuService.ts (已有)
    ├── im/dingtalk/DingTalkService.ts (预留)
    └── im/wecom/WeComService.ts (预留)
```

#### 10.10.6 验收标准

| 标准             | 说明                                 |
| ---------------- | ------------------------------------ |
| 飞书配置保存成功 | 填写正确配置后，IM服务能正常接收消息 |
| 测试连接反馈正确 | 连接成功/失败有明确提示              |
| 状态指示器准确   | ControlBar显示当前连接状态           |
| 配置热更新生效   | 保存后无需重启应用                   |

### 10.8 v1.0 (正式版)

**目标**: 开源营销 + 社区建设，打造开放生态

| 功能             | 周期       | 交付标准                              |
| ---------------- | ---------- | ------------------------------------- |
| **独立站点**     | Week 25-28 | 域名 opencowork.ai，官网展示          |
| **开源营销**     | Week 25-30 | GitHub repo优化、社交媒体、开发者社区 |
| **WhatsApp群组** | Week 26-28 | 用户社群运营、反馈收集                |

#### 10.8.1 企业安全增强

| 功能           | 说明                 | 优先级 |
| -------------- | -------------------- | ------ |
| Admin 控制面板 | 管理员管理用户和权限 | P0     |
| SSO 集成       | 企业账号系统集成     | P0     |
| 操作审计       | 完整操作日志         | P1     |
| Cowork 开关    | 管理员可禁用 Cowork  | P1     |

#### 10.8.2 API 完善

| 功能        | 说明           | 优先级 |
| ----------- | -------------- | ------ |
| RESTful API | 标准 REST 接口 | P0     |
| SDK         | 多语言 SDK     | P1     |
| Webhook     | 事件回调       | P1     |

#### 10.8.3 插件市场

| 功能     | 说明             | 优先级 |
| -------- | ---------------- | ------ |
| 插件分发 | 官方和第三方插件 | P0     |
| 插件安装 | 一键安装/卸载    | P0     |
| 插件审核 | 上架审核机制     | P1     |

#### 10.8.4 性能优化

| 功能     | 说明             | 优先级 |
| -------- | ---------------- | ------ |
| 启动优化 | 冷启动 < 3s      | P0     |
| 响应优化 | 操作延迟 < 500ms | P1     |
| 内存优化 | 空闲内存 < 1GB   | P1     |

#### 10.8.5 文档完善

| 功能       | 说明                   | 优先级 |
| ---------- | ---------------------- | ------ |
| 开发者文档 | API 文档、插件开发指南 | P0     |
| 用户指南   | 使用手册、常见问题     | P0     |
| 视频教程   | 入门视频               | P2     |

**里程碑**: 正式发布版本

---

## 14. v2.0 完整浏览器详细规划 (已发布)

> 更新日期: 2026-04-09
> **状态**: ✅ 已发布 (v0.10.x)

### 14.1 版本目标

将浏览器预览区升级为**真实浏览器**，通过 Playwright CDP 连接实现 AI 与用户共享同一浏览器实例。

用户可主动浏览网页、操作地址栏，AI 也能实时看到用户的操作。

### 14.2 功能清单

| 功能            | 说明                         | 优先级 |
| --------------- | ---------------------------- | ------ |
| 真实浏览器      | BrowserWindow 替代截图预览   | P0     |
| 完整地址栏      | URL 显示、可编辑、可导航     | P0     |
| 前进/后退       | 浏览历史导航                 | P0     |
| 刷新/停止       | 页面刷新、加载中断           | P0     |
| AI/用户同时操作 | 两者可同时操控同一浏览器     | P0     |
| 同步状态指示    | 显示当前谁在操作             | P1     |
| 三种预览模式    | Sidebar/Collapsible/Detached | P1     |

### 14.3 核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron Main Process                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐      ┌──────────────────────────────┐│
│  │   PreviewManager     │      │   BrowserExecutor (Playwright)││
│  │                      │      │                              ││
│  │  • BrowserWindow     │      │  • CDP 连接到 BrowserWindow  ││
│  │  • 工具栏 (内部)     │◄────►│  • Agent 通过 CDP 控制页面    ││
│  │  • 三种模式管理      │ CDP  │                              ││
│  │  • 用户交互事件      │ 9222 │                              ││
│  └──────────────────────┘      └──────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**架构说明：**

- BrowserWindow 是可见的真实浏览器，用户可直接操作
- Playwright 通过 Chrome DevTools Protocol (CDP) 连接到 BrowserWindow
- Agent 和用户共享同一个浏览器实例，操作实时同步

### 14.4 技术方案

#### 14.4.1 BrowserWindow vs BrowserView

| 组件          | 说明                                        |
| ------------- | ------------------------------------------- |
| BrowserView   | 无法被 Playwright 控制（Electron 内置组件） |
| BrowserWindow | 可通过 CDP 连接，被 Playwright 控制         |

#### 14.4.2 CDP 连接方式

```typescript
// BrowserExecutor 新增 CDP 连接模式
class BrowserExecutor {
  private cdpConnection: CDPSession | null = null;

  async connectToWindow(window: BrowserWindow): Promise<void> {
    // 通过 CDP 端口 9222 连接到 BrowserWindow
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    this.context = browser.contexts()[0];
    this.page = this.context.pages()[0];
  }
}
```

#### 14.4.3 端口配置

| 参数     | 默认值 | 说明                          |
| -------- | ------ | ----------------------------- |
| CDP 端口 | 9222   | Chrome DevTools Protocol 端口 |
| 可配置   | 是     | 后续可通过设置自定义端口      |

### 14.5 工具栏规格

#### 14.5.1 布局

```
┌──────────────────────────────────────────────────────────────┐
│ [←][→][↻][×] │ https://example.com │ [● 同步状态]          │
└──────────────────────────────────────────────────────────────┘
```

#### 14.5.2 按钮功能

| 按钮   | IPC Channel         | 功能                     |
| ------ | ------------------- | ------------------------ |
| ←      | `browser:goBack`    | 后退到上一页面           |
| →      | `browser:goForward` | 前进到下一页面           |
| ↻      | `browser:reload`    | 刷新当前页面             |
| ×      | `browser:stop`      | 停止页面加载             |
| 地址栏 | `browser:navigate`  | 显示当前 URL，可编辑跳转 |

#### 14.5.3 交互说明

- 地址栏可编辑，用户输入 URL 后回车即可跳转
- 工具栏位于 BrowserWindow 内部（顶部）
- 用户操作浏览器时，地址栏自动更新

### 14.6 三种预览模式

#### 14.6.1 Sidebar 模式（侧边预览）

```
┌─────────────────────────────────────────────────────────────┐
│  OpenCowork                              [─] [□] [×]        │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────┬───────────────────────────────────────────────┐ │
│ │         │ [👁️ 侧边] [📱 窗口] [🔲 折叠]    [接管] [×] │ │
│ │ 聊天区域 │─────────────────────────────────────────────│ │
│ │         │                                              │ │
│ │ AI正在.. │   BrowserWindow (附加到主窗口右侧)           │ │
│ │         │   [←][→][↻][×] │ URL │ [● 状态]              │ │
│ │ ✓ 已完成 │   ┌────────────────────────────────────┐    │ │
│ │ → 正在.. │   │                                    │    │ │
│ │         │   │    [真实网页 - 实时画面]             │    │ │
│ │         │   │                                    │    │ │
│ │         │   └────────────────────────────────────┘    │ │
│ │         │   width: 500px                               │ │
│ └─────────┴───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- BrowserWindow 附加到主窗口右侧
- 默认宽度: 500px
- 用户可调整宽度（后续版本）

#### 14.6.2 Collapsible 模式（可折叠）

```
收起状态:
┌─────────────────────────────────────────────────────────────┐
│ [👁️ 侧边] [📱 窗口] [🔲 折叠]    [点击展开]    [接管]     │
└─────────────────────────────────────────────────────────────┘

展开状态:
┌─────────────────────────────────────────────────────────────┐
│ [👁️ 侧边] [📱 窗口] [🔲 折叠]         [收起]      [接管]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   BrowserWindow (覆盖主窗口顶部)                            │
│   [←][→][↻][×] │ URL │ [● 状态]                           │
│   ┌────────────────────────────────────────────────────┐   │
│   │                                                        │   │
│   │    [真实网页 - 实时画面]                              │   │
│   │                                                        │   │
│   └────────────────────────────────────────────────────┘   │
│   height: 60% 窗口高度                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- 默认收起，只显示标签栏（40px）
- 点击展开，占 60% 窗口高度
- 适合需要更多聊天空间时

#### 14.6.3 Detached 模式（独立窗口）

```
┌─────────────────────────────────────────────┐
│  OpenCowork Preview          [─] [□] [×]   │
├─────────────────────────────────────────────┤
│ [👁️ 侧边] [📱 窗口] [🔲 折叠]    [接管]    │
├─────────────────────────────────────────────┤
│                                             │
│  BrowserWindow (独立窗口，可拖到副屏)       │
│  [←][→][↻][×] │ URL │ [● 状态]             │
│  ┌─────────────────────────────────────┐    │
│  │                                      │    │
│  │    [真实网页 - 实时画面]            │    │
│  │                                      │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  默认尺寸: 1024 x 768                       │
└─────────────────────────────────────────────┘
```

- 完全独立的 BrowserWindow
- 可拖到副屏或多显示器
- 关闭自动切回 Sidebar 模式

### 14.7 同步状态指示

#### 14.7.1 状态类型

| 状态         | 图标    | 说明                    |
| ------------ | ------- | ----------------------- |
| Agent 空闲   | 🟢 绿色 | AI 未操作，等待用户指令 |
| Agent 操作中 | 🔵 蓝色 | AI 正在执行任务         |
| 用户操作中   | 🟠 橙色 | 用户正在操作浏览器      |

#### 14.7.2 状态切换逻辑

```
用户打开预览 → 显示 "Agent 空闲"
AI 开始执行 → 显示 "Agent 操作中"
用户接管 → 显示 "用户操作中"
用户交还 → 显示 "Agent 操作中"
任务完成 → 显示 "Agent 空闲"
```

### 14.8 改动文件清单

| 文件路径                               | 改动内容                                                                                              | 优先级 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------ |
| `src/preview/PreviewManager.ts`        | 重写：BrowserView → BrowserWindow，支持工具栏                                                         | P0     |
| `src/core/executor/BrowserExecutor.ts` | 新增：CDP 连接模式，连接 BrowserWindow                                                                | P0     |
| `src/main/ipcHandlers.ts`              | 新增 IPC：`browser:navigate`、`browser:goBack`、`browser:goForward`、`browser:reload`、`browser:stop` | P0     |
| `src/preview/types.ts`                 | 新增：工具栏类型定义、PreviewMode 配置                                                                | P1     |

### 14.9 与现有系统集成

| 系统              | 集成点     | 方式                            |
| ----------------- | ---------- | ------------------------------- |
| BrowserExecutor   | CDP 连接   | Playwright 连接 BrowserWindow   |
| TakeoverManager   | 控制权交接 | AI/用户模式切换（保留接管按钮） |
| ScreencastService | 替代方案   | CDP 连接后不再需要截图服务      |
| TaskEngine        | 浏览器操作 | 复用现有 Action 执行逻辑        |

### 14.10 实施计划

| Week | 任务                | 交付物                          | 状态 |
| ---- | ------------------- | ------------------------------- | ---- |
| 1-2  | PreviewManager 重构 | BrowserWindow 替代 BrowserView  | -    |
| 2-3  | 工具栏组件          | 地址栏、前进/后退/刷新/停止按钮 | -    |
| 3-4  | CDP 连接集成        | Playwright 连接 BrowserWindow   | -    |
| 4-5  | 三种模式实现        | Sidebar/Collapsible/Detached    | -    |
| 5-6  | 状态同步 + 测试     | 同步状态指示、完整功能测试      | -    |

### 14.11 技术约束说明

1. **BrowserWindow 特性**：BrowserWindow 是独立窗口（可拖到副屏），不是嵌入主窗口的视图。这是技术限制，无法改变。

2. **三种模式调整**：
   - Sidebar → BrowserWindow 附加到主窗口右侧
   - Collapsible → BrowserWindow 可折叠/展开
   - Detached → 完全独立的 BrowserWindow

3. **接管机制保留**：用户可随时点击"接管"按钮暂停 AI 操作，AI 和用户可同时操作同一浏览器实例（通过 CDP 同步）。

---

## 15. 附录

### 15.1 术语表

| 术语         | 英文         | 定义                      |
| ------------ | ------------ | ------------------------- |
| OpenCowork   | OpenCowork   | AI原生桌面助手产品名称    |
| Dispatch     | Dispatch     | 多端协同、任务分发系统    |
| Scheduler    | Scheduler    | 定时任务调度系统          |
| Skill        | Skill        | Prompt模板+工具的技能封装 |
| Connector    | Connector    | 外部工具连接器            |
| Computer Use | Computer Use | AI像人类一样操作计算机    |
| Action Layer | Action Layer | 统一动作描述和路由层      |

### 15.2 参考资料

| 资料           | 说明          |
| -------------- | ------------- |
| Claude Cowork  | 产品参考      |
| Puppeteer Docs | Browser自动化 |
| Electron Docs  | 桌面应用框架  |
| BullMQ         | 任务队列      |
| node-cron      | Cron调度      |

### 15.3 技术选型理由

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

| 版本 | 日期       | 修改内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0 | 2026-03-25 | 初始PRD，AI Browser定位                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| v2.0 | 2026-03-27 | 重大更新：<br>- 新增产品名称OpenCowork<br>- 新增多端协同Dispatch系统<br>- 新增定时任务调度系统<br>- 借鉴Claude Cowork的Plugins生态<br>- 借鉴Cowork的安全和权限设计<br>- 调整技术架构<br>- 更新路线图                                                                                                                                                                                                                                                                                                                                              |
| v2.1 | 2026-03-27 | 新增浏览器预览模块：<br>- 新增3.6节PreviewManager技术架构<br>- 新增8.6节浏览器预览模块UI设计<br>- 新增场景4：实时观看浏览器操作<br>- 更新7.4节接管机制（观看模式/接管模式）<br>- 更新路线图（v0.1独立窗口→v0.3侧边预览→v0.5可折叠）                                                                                                                                                                                                                                                                                                               |
| v2.2 | 2026-03-27 | PRD评审修复：<br>- 修复代码重复问题（TakeoverResult/TakeoverOption）<br>- 添加isExpanded属性声明<br>- 添加PreviewConfig配置接口，替代硬编码尺寸<br>- 细化画面同步技术描述（CDP会话绑定）<br>- 简化模块结构为方法模式<br>- 补充控制栏[×]关闭按钮说明<br>- 补充预览可关闭/可配置特性                                                                                                                                                                                                                                                                |
| v2.5 | 2026-03-30 | v0.4 LangGraph重构架构确认：<br>- createReactAgent 代替完整 StateGraph（已确认）<br>- agentLogger 代替 LangSmith（已确认）<br>- MemorySaver 代替 SQLite Checkpointer（已确认）                                                                                                                                                                                                                                                                                                                                                                    |
| v2.8 | 2026-03-31 | v0.7 飞书机器人方案确认：<br>- 飞书机器人替代独立Mobile App<br>- 企业消息订阅实现主动推送<br>- IM抽象接口预留（支持未来钉钉/企业微信）<br>- Week 29-38 详细实施计划                                                                                                                                                                                                                                                                                                                                                                               |
| v2.9 | 2026-03-31 | v1.0 开源营销规划：<br>- 独立站点 opencowork.ai<br>- GitHub repo优化、开发者社区建设<br>- WhatsApp用户群组运营                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| v3.0 | 2026-03-31 | v2.0 完整浏览器规划：<br>- 浏览器预览区升级为真实浏览器<br>- 新增地址栏、标签页、前进后退<br>- AI/用户控制权切换<br>- 共享 BrowserContext<br>- Week 39-45 实施计划                                                                                                                                                                                                                                                                                                                                                                                |
| v3.1 | 2026-04-02 | v0.8 WebFetch工具规划：<br>- 新增10.9节 v0.8 (WebFetch + 工具增强)<br>- WebFetch Tool完整功能规格（URL/format/timeout/method/headers/retryOnUAChange/redirect/cookieJar/proxy）<br>- UA重试机制（5个User-Agent轮换）<br>- turndown作为HTML→Markdown转换库<br>- 支持认证型代理格式<br>- Week 39-43 实施计划                                                                                                                                                                                                                                        |
| v3.2 | 2026-04-06 | v0.9 IM配置增强规划：<br>- 新增10.10节 v0.9 (IM配置增强)<br>- 新增4.7节IM配置面板规格<br>- 新增IMConfigPanel组件规格<br>- 新增ControlBar IM状态指示器<br>- 新增IPC通信规格（im:load/save/test/status）<br>- **长连接架构变更**：飞书采用WebSocket长连接，无需公网服务器<br>- 简化配置项（移除verificationToken/encryptKey/回调地址）<br>- Week 44实施计划                                                                                                                                                                                         |
| v3.3 | 2026-04-09 | v2.0 完整浏览器规划更新：<br>- **技术方案变更**：BrowserView → BrowserWindow + Playwright CDP<br>- 新增14.2节功能清单（P0/P1优先级）<br>- 新增14.3节核心架构图<br>- 新增14.4节技术方案（BrowserWindow vs BrowserView、CDP连接方式、端口配置）<br>- 新增14.5节工具栏规格（按钮功能、地址栏交互）<br>- 新增14.6节三种预览模式（Sidebar/Collapsible/Detached详细说明）<br>- 新增14.7节同步状态指示（状态类型、切换逻辑）<br>- 新增14.8节改动文件清单<br>- 新增14.9节与现有系统集成<br>- 新增14.10节实施计划（Week 1-6）<br>- 新增14.11节技术约束说明 |
| v3.4 | 2026-04-17 | v2.0 智能增强规划：<br>- **新增第16章**：借鉴 hermes-agent 自改进系统<br>- Skills 自改进系统（Agent 从经验创建 Skills）<br>- 会话记忆搜索（FTS5 + LLM 总结）<br>- 渐进式技能加载（Progressive Disclosure）<br>- 中断与恢复机制<br>- Tips: 添加 hermes-agent GitHub 链接                                                                                                                                                                                                                                                                           |
| v3.5 | 2026-04-17 | v2.0完整浏览器已发布 + v3.0智能增强规划：<br>- **第14章标记为已发布**<br>- **第16章改名为v3.0智能增强规划**<br>- 更新文档版本为v3.5                                                                                                                                                                                                                                                                                                                                                                                                               |
| v4.0 | 2026-04-19 | 新增后续版本规划：<br>- **新增第18章**：PRD 4.0 版本规划（v0.11）<br>- 聚焦 Browser-first 任务完成与结果交付<br>- 强化核心闭环与历史/结果组织方式<br>- **新增第19章**：PRD 5.0 版本规划（v0.12）<br>- 强化任务模板、统一任务模型、Skills/MCP/跨端产品化闭环<br>- 更新文档版本为 v4.0 |

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

## 17. v3.0 智能增强规划

> 更新日期: 2026-04-17
> **状态**: 规划中 (未发布)
> **参考**: [Hermes Agent - NousResearch](https://github.com/NousResearch/hermes-agent)

**版本目标**: 借鉴 hermes-agent 的自改进机制，构建 OpenCowork 的学习与记忆系统

### 17.1 功能清单

| 功能                  | 优先级 | 周期     | 说明                           |
| --------------------- | ------ | -------- | ------------------------------ |
| **Skills 自改进系统** | P0     | Week 1-4 | Agent 从经验中创建/改进 Skills |
| **会话记忆搜索**      | P0     | Week 2-5 | FTS5 全文搜索 + LLM 总结       |
| **渐进式技能加载**    | P1     | Week 4-6 | 按需加载，减少 token 消耗      |
| **中断与恢复机制**    | P1     | Week 5-7 | API 调用可随时中断             |

### 17.2 Skills 自改进系统

#### 17.2.1 核心概念

借鉴 hermes-agent 的 **Closed Learning Loop**，Agent 在完成任务过程中自动创建 Skills。

```
任务执行 → 遇到复杂问题 → 找到解决方案 → 保存为 Skill
                                        ↓
                    下次遇到类似任务 → 自动调用已有 Skill
```

#### 17.2.2 Skill 创建触发条件

| 触发条件     | 描述                     |
| ------------ | ------------------------ |
| 复杂任务完成 | 5+ tool calls 成功执行   |
| 错误后恢复   | 遇到错误但找到解决方案   |
| 用户纠正     | 用户手动调整 AI 操作方式 |
| 非重复工作流 | 发现可复用的操作模式     |

#### 17.2.3 Skill 数据结构

```yaml
---
name: organize-downloads
description: 智能整理 Downloads 文件夹，按类型分类
version: 1.0.0
platforms: [macos, linux, windows]
metadata:
  tags: [file, automation, organizer]
  category: system
  fallback_for_toolsets: []
  requires_toolsets: [cli]
---
# Organize Downloads Skill

## When to Use
当用户要求整理 Downloads、桌面或指定文件夹时使用。

## Procedure
1. 扫描目标文件夹，获取所有文件
2. 按文件类型分类（图片/文档/压缩包/视频等）
3. 创建分类子文件夹
4. 移动文件到对应分类
5. 生成整理报告

## Pitfalls
- 不要删除任何文件，只移动
- 保留原文件的修改时间
- 跳过隐藏文件（.开头）

## Verification
检查分类后的文件夹结构是否符合预期
```

#### 17.2.4 与现有 Skill 系统集成

| 现有功能    | 增强点                         |
| ----------- | ------------------------------ |
| SkillPanel  | 新增"保存当前操作为 Skill"按钮 |
| SkillLoader | 支持 agent 创建的 Skills       |
| SkillMarket | 可导入/导出 Skills             |

### 17.3 会话记忆搜索

#### 17.3.1 双层记忆架构

```
┌─────────────────────────────────────────────────────────┐
│                    记忆系统架构                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐      ┌─────────────────┐        │
│  │  持久记忆       │      │  会话搜索        │        │
│  │  MEMORY.md     │      │  SQLite FTS5    │        │
│  │  (Agent 笔记)   │      │  (全文检索)      │        │
│  └─────────────────┘      └─────────────────┘        │
│          │                        │                   │
│          ▼                        ▼                   │
│  ┌──────���──────────────────────────────────────────┐   │
│  │              记忆注入层                           │   │
│  │  • 会话开始时注入 MEMORY.md                     │   │
│  │  • 可搜索历史会话                               │   │
│  │  • LLM 总结搜索结果                            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

#### 17.3.2 持久记忆 (MEMORY.md)

| 字段   | 限制        | 说明             |
| ------ | ----------- | ---------------- |
| 总大小 | ~800 tokens | 严格字符限制     |
| 单条   | ~200 chars  | 保持条目简短     |
| 去重   | 是          | 重复内容自动拒绝 |

**操作接口**:

```typescript
memory(action: 'add', target: 'memory', content: '用户偏好深色模式')
memory(action: 'replace', target: 'memory', oldText: 'dark mode', content: 'light mode')
memory(action: 'remove', target: 'memory', oldText: 'dark mode')
```

#### 17.3.3 会话搜索 (FTS5)

| 功能     | 说明                       |
| -------- | -------------------------- |
| 全文索引 | 所有会话内容建立 FTS5 索引 |
| LLM 总结 | 搜索结果由 LLM 总结后返回  |
| 跨会话   | 支持跨历史会话的知识召回   |

### 17.4 渐进式技能加载

#### 17.4.1 渐进式披露模式

借鉴 hermes-agent 的 **Progressive Disclosure** 模式，最小化 token 消耗：

| Level   | 内容                         | Token 消耗   |
| ------- | ---------------------------- | ------------ |
| Level 0 | Skills 列表 (名称/描述/分类) | ~500 tokens  |
| Level 1 | 完整 Skill 内容              | ~2-5k tokens |
| Level 2 | 特定参考文件                 | 按需         |

#### 17.4.2 加载触发

```
用户请求 "整理文件"
    ↓
加载 Level 0 → 显示所有相关 Skills
    ↓
用户/Agent 选择 "organize-downloads"
    ↓
加载 Level 1 → 完整 Skill 内容
    ↓
执行 Skill
```

### 17.5 中断与恢复机制

#### 17.5.1 中断架构

```
┌──────────────────────┐     ┌──────────────┐
│  Main thread         │     │  API thread   │
│  wait on:            │────▶│  HTTP POST  │
│  - response ready     │     │  to LLM     │
│  - interrupt event  │     └──────────────┘
│  - timeout          │
└──────────────────────┘
```

#### 17.5.2 中断触发点

| 触发方式           | 响应时间 | 说明           |
| ------------------ | -------- | -------------- |
| 点击"暂停"按钮     | < 100ms  | 界面按钮       |
| 用户直接操作浏览器 | < 100ms  | 检测到鼠标动作 |
| 飞书发送"暂停"     | < 500ms  | 远程命令       |

#### 17.5.3 状态恢复

| 状态       | 恢复方式                   |
| ---------- | -------------------------- |
| API 调用中 | 中断 HTTP 请求，保留上下文 |
| 工具执行中 | 执行完成当前步骤后暂停     |
| 页面操作   | 保留 DOM 状态，可继续      |

### 17.6 改动文件清单

| 文件路径                                 | 改动内容                  | 优先级 |
| ---------------------------------------- | ------------------------- | ------ |
| `src/skills/skillRunner.ts`              | 新增 `saveAsSkill()` 方法 | P0     |
| `src/skills/skillLoader.ts`              | 支持 agent 创建的 Skills  | P0     |
| `src/memory/agentMemory.ts`              | 新增 MEMORY.md 管理       | P0     |
| `src/history/historyStore.ts`            | 新增 FTS5 全文索引        | P0     |
| `src/core/runtime/TaskEngine.ts`         | 新增中断/恢复支持         | P1     |
| `src/renderer/components/SkillPanel.tsx` | 新增"保存为 Skill" UI     | P1     |

### 17.7 验收标准

| 功能          | 验收标准                         |
| ------------- | -------------------------------- |
| Skills 自改进 | Agent 成功从历史任务创建新 Skill |
| 会话记忆      | 可��索历史会话并返回 LLM 总结    |
| 渐进加载      | Skill 列表 < 1000 tokens         |
| 中断恢复      | 暂停后恢复，任务上下文完整       |

### 17.8 实施计划

| Week | 任务               | 交付物                         |
| ---- | ------------------ | ------------------------------ |
| 1-2  | Skill 自改进核心   | saveAsSkill(), Skill 保存/加载 |
| 2-3  | 持久记忆 MEMORY.md | 写入/读取 MEMORY.md            |
| 3-4  | 会话搜索 FTS5      | 全文索引, LLM 总结             |
| 4-5  | 渐进式加载         | Level 0/1/2 加载               |
| 5-6  | 中断/恢复机制      | 状态保存, 恢复                 |
| 6-7  | 测试与优化         | 集成测试, 性能优化             |

---

## 18. PRD 4.0 版本规划（v0.11）

> 更新日期: 2026-04-19
> **状态**: 规划中 (未发布)

**版本目标**: 收敛产品主线，围绕“网页任务执行并交付结果”打造稳定、可复用、可感知价值的核心闭环。

### 18.1 规划原则

1. Browser-first: 优先强化网页任务成功率，而不是继续扩张能力面。
2. Delivery-first: 任务结束必须突出结果物与结论，而不只是展示执行过程。
3. Core-loop-first: 聊天发起、执行、人工介入、结果交付、历史复用必须形成单一闭环。
4. Platform-second: Skills、MCP、Scheduler、IM 均作为增强项服务主线，而非并列主入口。

### 18.2 核心范围

| 模块 | 优先级 | 目标 | 说明 |
| ---- | ------ | ---- | ---- |
| **Browser 任务完成** | P0 | 提升端到端成功率 | 聚焦搜索、提取、表单填写、页面跳转、结果整理 |
| **结果交付面板** | P0 | 让用户拿到结果物 | 统一展示结论、关键数据、生成文件、链接、可再次运行入口 |
| **任务历史重构** | P0 | 以成果为中心组织历史 | 历史记录按任务、产出、状态、可复用性展示，而不是仅按步骤展示 |
| **主流程收敛** | P1 | 弱化平台感 | 首页和主流程突出核心场景，弱化 MCP/Skill/调度 的抢入口感 |
| **可复用自动化入口** | P1 | 从一次执行走向长期复用 | 任务成功后支持保存为模板或加入定时任务 |

### 18.3 关键体验目标

#### 18.3.1 单次任务闭环

```
用户输入任务
    ↓
AI 规划并执行网页任务
    ↓
必要时人工确认/接管
    ↓
输出结果交付面板
    ↓
结果进入历史并支持再次运行/保存模板
```

#### 18.3.2 结果交付标准

任务完成后，至少满足以下之一：

- 输出结构化摘要
- 输出关键提取结果
- 输出文件或链接
- 输出可继续复用的任务入口

### 18.4 功能清单

| 功能 | 优先级 | 周期 | 说明 |
| ---- | ------ | ---- | ---- |
| Browser 成功率优化 | P0 | Week 1-3 | 降低误点、误提取、重复截图，提升 noisy page 稳定性 |
| 结果交付面板 | P0 | Week 1-3 | 新增任务完成后的统一结果展示区 |
| 历史按成果组织 | P0 | Week 2-4 | 历史页突出结论、文件、链接、可复用入口 |
| 主界面信息收敛 | P1 | Week 3-4 | 弱化技术型入口，突出高频工作场景 |
| 成功任务保存为模板 | P1 | Week 4-5 | 成功任务可一键保存为复用模板 |
| 典型场景模板 | P1 | Week 4-5 | 内置网页采集、搜索总结、表单填写等模板 |

### 18.5 结果交付面板规格

| 区块 | 内容 | 说明 |
| ---- | ---- | ---- |
| 最终结论 | AI 产出的任务结论 | 适合阅读与转发 |
| 关键结果 | 提取出的列表、表格、字段 | 适合快速核对 |
| 交付物 | 文件路径、下载链接、截图、报告 | 适合直接使用 |
| 后续动作 | 再次运行、保存模板、加入调度 | 适合沉淀复用 |

### 18.6 验收指标

| 指标 | 目标 |
| ---- | ---- |
| 网页任务端到端成功率 | 持续提升，作为首要产品指标 |
| 有结果物的任务占比 | 显著提升 |
| 历史任务可复用率 | 成功任务支持再次运行或保存模板 |
| 用户首日理解成本 | 降低首页和主流程的技术名词密度 |

### 18.7 实施计划

| Week | 任务 | 交付物 |
| ---- | ---- | ------ |
| 1-2 | Browser 主链路优化 | 搜索/提取/表单任务稳定性提升 |
| 2-3 | 结果交付面板 | 统一结果展示 UI + 数据结构 |
| 3-4 | 历史记录重构 | 结果导向的历史页与再次运行入口 |
| 4-5 | 模板沉淀能力 | 保存模板、内置典型模板 |
| 5-6 | 文档与场景优化 | 面向用户的核心场景表达与上手路径 |

---

## 19. PRD 5.0 版本规划（v0.12）

> 更新日期: 2026-04-19
> **状态**: 规划中 (未发布)

**版本目标**: 在 v0.11 核心闭环稳定后，构建“任务模板 + 统一任务模型 + 多入口复用”的产品化自动化体系。

### 19.1 核心方向

1. 让成功任务沉淀为长期资产，而不是一次性执行记录。
2. 让聊天、调度、飞书、MCP 基于同一套任务模型工作。
3. 让 Skills 从开发者能力包升级为可理解、可复用的产品能力。
4. 让 MCP 从技术协议能力升级为业务解决方案入口。

### 19.2 核心范围

| 模块 | 优先级 | 目标 | 说明 |
| ---- | ------ | ---- | ---- |
| **任务模板系统** | P0 | 建立复用入口 | 成功任务一键保存为模板，并可参数化执行 |
| **统一任务模型** | P0 | 打通多入口业务逻辑 | 统一模板、任务实例、执行记录、结果物模型 |
| **Skills 产品化** | P1 | 从工具封装走向能力封装 | 明确输入输出、结果预期、失败反馈、复用方式 |
| **MCP 业务封装** | P1 | 从协议走向场景 | 以官方推荐场景和连接器模板呈现 MCP 价值 |
| **跨端闭环增强** | P1 | 从远程触发走向远程跟踪 | 飞书侧支持查看进度、关键结果、失败后重试 |

### 19.3 统一任务模型

#### 19.3.1 核心对象

```typescript
interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  executionProfile: 'browser-first' | 'mixed';
}

interface TaskRun {
  id: string;
  templateId?: string;
  source: 'chat' | 'scheduler' | 'im' | 'mcp';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  resultId?: string;
}

interface TaskResult {
  id: string;
  summary: string;
  artifacts: string[];
  reusable: boolean;
}
```

#### 19.3.2 业务收益

- 同一任务可被聊天、调度、飞书、MCP 复用
- 历史、结果、模板三者形成闭环
- 产品能力从“会执行”升级到“可持续自动化”

### 19.4 功能清单

| 功能 | 优先级 | 周期 | 说明 |
| ---- | ------ | ---- | ---- |
| 任务模板中心 | P0 | Week 1-2 | 浏览、编辑、运行、删除模板 |
| 模板参数化执行 | P0 | Week 2-3 | 模板支持输入参数和默认值 |
| 调度/飞书统一接入模板 | P0 | Week 3-4 | 调度和 IM 任务优先基于模板触发 |
| Skills 产品化升级 | P1 | Week 3-5 | 技能增加输入输出契约和结果说明 |
| MCP 官方场景封装 | P1 | Week 4-5 | 预置连接说明、推荐场景、调用示例 |
| 跨端结果跟踪 | P1 | Week 5-6 | 飞书查看关键结果、失败原因、再次运行 |

### 19.5 产品化强化点

| 方向 | 强化内容 |
| ---- | -------- |
| Skills | 不只返回脚本路径，还要明确用途、输入、输出、失败提示 |
| MCP | 不只展示 server/tool 列表，还要展示“接入后能做什么” |
| Scheduler | 不只配置 cron，还要围绕模板和结果回看设计 |
| IM | 不只发任务和收通知，还要支持结果消费与再次触发 |

### 19.6 验收指标

| 指标 | 目标 |
| ---- | ---- |
| 成功任务转模板比例 | 持续提升 |
| 模板复用率 | 聊天/调度/飞书场景均可复用 |
| 跨入口一致性 | 相同任务在不同入口具有统一状态与结果结构 |
| 远程任务闭环率 | 飞书侧可完成查看结果与再次触发 |

### 19.7 实施计划

| Week | 任务 | 交付物 |
| ---- | ---- | ------ |
| 1-2 | 模板中心与数据模型 | TaskTemplate/TaskRun/TaskResult 结构 |
| 2-3 | 参数化模板执行 | 模板运行 UI + 参数传递 |
| 3-4 | 调度与 IM 统一接入 | 基于模板的调度/飞书任务流 |
| 4-5 | Skills/MCP 产品化 | 连接器场景封装、技能契约增强 |
| 5-6 | 远程跟踪与复用 | 飞书结果查看、失败重试、再次运行 |

---

## 20. PRD 6.0 版本规划（v0.13）

> 更新日期: 2026-04-26
> **状态**: 规划中 (未发布)

**版本目标**: 在 P3 完成平台化与桌面扩展验证后，把 OpenCowork 从 browser-first Hybrid CUA 平台推进到支持桌面级 computer use 的正式产品化阶段，形成 browser / desktop / hybrid 一体化执行能力。

### 20.1 核心方向

1. 把 computer use 从浏览器执行扩展到本地应用、文件系统和跨应用流程。
2. 建立 browser、desktop、hybrid 三类执行目标的一致抽象。
3. 为桌面级任务建立更严格的确认、恢复和评测闭环。
4. 让行业 workflow 能够自然覆盖浏览器与本地应用联合场景。

### 20.2 核心范围

| 模块 | 优先级 | 目标 | 说明 |
| ---- | ------ | ---- | ---- |
| **Desktop Execution Adapter** | P0 | 建立桌面执行抽象 | 从 browser-only adapter 走向 browser / desktop / hybrid 统一协议 |
| **Isolated Runtime / VM Harness** | P0 | 建立安全执行环境 | 基于 VM、container 或受控 runtime 承载桌面级动作 |
| **Desktop Workflow Contract** | P0 | 支持本地应用与文件系统流程 | 覆盖打开、保存、复制粘贴、上传下载等高频办公链路 |
| **Desktop Approval & Recovery** | P1 | 强化高风险确认与失败恢复 | 对发送、覆盖、上传、权限授权等动作提高保护级别 |
| **Desktop Benchmark Suite** | P1 | 建立桌面级评测体系 | 覆盖桌面-only 与 browser + desktop mixed workflow |

### 20.3 执行模型

#### 20.3.1 统一执行目标

```typescript
interface ComputerExecutionTarget {
  kind: 'browser' | 'desktop' | 'hybrid';
  environment: 'playwright' | 'vm' | 'container' | 'native-bridge';
}
```

#### 20.3.2 设计原则

- 上层任务、模板、结果系统不应感知底层是 browser 还是 desktop。
- capability registry 从视觉能力扩展到桌面动作能力。
- approval、recovery、benchmark 必须在 desktop 目标下继续成立，而不是只在浏览器内有效。

### 20.4 典型用户场景

- 浏览器下载报表后，在本地办公软件中整理，再回到网页上传。
- 浏览器提取信息后，复制到本地 IM 或邮件客户端发送。
- 本地文件系统批量处理后，回到业务后台核验并提交结果。
- 浏览器与本地应用联合完成日常办公和运营工作流。

### 20.5 用户可见变化

- 自动化范围从网页扩展到桌面工作流。
- 支持本地应用和文件系统中的任务执行。
- 用户可感知当前运行目标为 browser、desktop 或 hybrid。
- 高风险桌面动作会有更明确的确认与接管体验。

### 20.6 本版不包含

- 不一次性支持所有桌面应用。
- 不直接开放宿主机的任意高权限控制。
- 不先解决所有企业级治理、权限编排和大规模分发问题。
- 不要求在一个版本内完成所有行业场景的桌面覆盖。

### 20.7 交付标准

- 至少一种 desktop harness 可稳定运行。
- 至少跑通一条 browser + desktop 联动 workflow。
- 桌面级 approval / recovery / benchmark 进入统一主链路。
- 上层产品层继续保持对底层 adapter 差异的弱感知。

### 20.8 成功指标

| 指标 | 目标 |
| ---- | ---- |
| 桌面最小任务集完成率 | 建立可稳定复现的基线 |
| Browser + Desktop 联动成功率 | 持续提升 |
| 高风险动作确认覆盖率 | 关键动作全覆盖 |
| Desktop Recovery 成功率 | 建立首版可衡量指标 |
| Desktop Benchmark 可重复运行率 | 达成 |

### 20.9 实施计划

| Week | 任务 | 交付物 |
| ---- | ---- | ------ |
| 1-2 | 执行抽象重构 | browser / desktop / hybrid 执行目标定义 |
| 2-4 | desktop harness 验证 | 至少一种 VM / container / 受控 runtime 跑通 |
| 4-5 | approval / recovery 接入 | 桌面级确认、恢复和日志链路 |
| 5-6 | benchmark 与行业样例 | 桌面级评测任务 + 首批混合 workflow |
| 6-7 | 文档与契约收口 | 对外接入契约、使用说明、风险边界 |

### 20.10 对应技术规格

- 详细技术规格见：`docs/SPEC_P4_desktop-computer-use-productization.md`

---

## 21. PRD 7.0 版本规划（v0.14）

> 更新日期: 2026-05-02
> **状态**: 规划中 (未发布)
> **参考**: [OpenAI Codex](https://github.com/openai/codex) 本地 Agent 工程体系

**版本目标**: 在 PRD 6.0 完成 browser / desktop / hybrid computer use 产品化后，把 OpenCowork 的核心能力从 Electron 应用内能力升级为可协议化、可审批、可观测、可多客户端复用的本地 Agent Runtime。

### 21.1 背景与借鉴点

OpenAI Codex 的核心参考价值不在于复制 Rust CLI/TUI，也不在于照搬重沙箱模型，而在于它把本地 Agent 产品拆成了更清晰的工程边界：协议层、审批/权限、执行策略、配置、App Server、多客户端复用、trace/diff、测试和模块拆分纪律。

OpenCowork 已经具备 browser automation、desktop/hybrid computer use、技能、MCP、历史、调度、IM 和结果交付能力。PRD 7.0 的重点是把这些能力收敛为稳定的 Agent Runtime，而不是继续堆叠入口和单点功能。

### 21.2 核心方向

1. **协议层独立化**: 把 task event、runtime command、approval request、execution output、error code、artifact 等抽成 shared protocol。
2. **运行时 API 化**: 把 Electron UI、Scheduler、IM、MCP、未来 CLI / Web UI 都收敛到同一个 Agent Runtime API。
3. **统一审批策略**: 让 browser、desktop、visual、CLI、MCP、skill 的高风险动作都走同一套 approval policy。
4. **执行输出结构化**: 对 CLI、MCP、Skill、Browser、Desktop 输出建立统一模型，支持长输出截断、artifact 和审计。
5. **Plan Mode 产品化**: 把“只读分析 / 规划”和“执行修改”做成明确模式，降低误操作和误执行。
6. **Workspace Rules 产品化**: 自动加载并展示 `AGENTS.md` 等项目规则，让规则进入规划、审批和 trace。
7. **Trace / Diff 可观测性**: 任务结束后可复盘计划、动作、审批、截图、命令输出、文件变化和最终结果。
8. **配置系统收口**: 统一 settings、MCP、skills、approval、logs、SQLite、visual provider 等配置入口。
9. **TaskEngine 瘦身**: 保留 `TaskEngine` facade，逐步拆出 lifecycle、approval、trace、state persistence、rules、config 等模块。

### 21.3 核心范围

| 模块 | 优先级 | 目标 | 说明 |
| ---- | ------ | ---- | ---- |
| **Shared Protocol Layer** | P0 | 统一跨进程/跨入口契约 | main、renderer、core、IM、MCP、scheduler 不再各自定义 payload |
| **Agent Runtime API** | P0 | 建立本地运行时 facade | Electron、Scheduler、IM、MCP 通过同一 API 触发和查询任务 |
| **Unified Approval Policy** | P0 | 审批策略收敛 | 覆盖 browser / desktop / visual / CLI / MCP / skill |
| **Structured Execution Output** | P0 | 执行结果可解释、可持久化 | stdout、stderr、exitCode、duration、artifact、error 统一建模 |
| **Plan Mode** | P1 | 区分只读规划和执行修改 | 禁止 Plan Mode 写文件、提交表单、执行写命令 |
| **Workspace Rules** | P1 | `AGENTS.md` 产品化 | 自动加载、trace 展示、影响规划和审批 |
| **Trace / Diff / File Watcher** | P1 | 建立审计级任务轨迹 | 关联计划、动作、审批、截图、输出、文件变更和结果 |
| **Runtime Config Schema** | P1 | 配置统一和可迁移 | schema、默认值、读取失败回退、写入并发保护 |
| **Runtime Decomposition** | P2 | 降低核心模块膨胀 | 从 `TaskEngine` 拆出 coordinator / service |

### 21.4 目标架构

```text
┌─────────────────────────────────────────────────────────────┐
│                         Clients                              │
│  Electron UI  Scheduler  Feishu/IM  MCP Server  Future CLI   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Agent Runtime API                         │
│  startTask / interrupt / resume / cancel / approve / readRun  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Shared Protocol Layer                     │
│  RuntimeCommand / RuntimeEvent / Approval / Output / Error    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     Runtime Services                         │
│ Lifecycle  Approval  Trace  Config  Rules  State Persistence │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     Execution Adapters                       │
│ Browser  Desktop/Visual  CLI  MCP  Skill                     │
└─────────────────────────────────────────────────────────────┘
```

### 21.5 关键产品能力

#### 21.5.1 统一运行时事件

所有入口发起的任务都产生同一类 run event：

```typescript
interface RuntimeEvent {
  id: string;
  runId: string;
  type: 'task/started' | 'tool/call_started' | 'approval/requested' | 'task/completed' | 'task/failed';
  payload: Record<string, unknown>;
  timestamp: number;
}
```

用户价值：同一个任务无论来自聊天、调度、飞书还是 MCP，都能在历史、结果、运行详情里以一致方式查看。

#### 21.5.2 统一审批体验

审批弹窗不再只服务视觉动作，而是服务所有高风险动作：

- 浏览器提交表单、点击支付/发送/删除类按钮
- 桌面文件覆盖、上传、下载、启动外部应用
- CLI 写文件、执行长耗时或影响系统状态的命令
- MCP 工具调用外部系统
- Skill 执行高影响动作

审批必须展示风险原因、命中的规则、动作摘要、任务上下文和继续/拒绝入口。

#### 21.5.3 Plan Mode

当用户表达“分析一下”“先给方案”“review”“不要改动”时，系统进入 Plan Mode。

Plan Mode 行为：

- 允许读取、搜索、观察、截图、总结
- 禁止写文件、提交表单、点击高风险按钮、执行写命令
- 切换到 Execute Mode 必须用户确认
- 计划可保存为任务草稿或模板草稿

#### 21.5.4 可审计 Trace

任务详情页应能展示：

- 用户输入与任务来源
- 规划结果
- 每一步动作及输出
- 审批请求与用户响应
- 浏览器 / 桌面截图
- CLI / MCP / Skill 输出
- 文件变更和 diff artifact
- 最终结果与交付物

### 21.6 本版不包含

- 不将主产品形态改为终端 TUI。
- 不将核心实现迁移到 Rust。
- 不一次性开放本地 HTTP / websocket server 给外部网络访问。
- 不一次性完成企业级团队权限、组织策略和审计后台。
- 不移除现有 Electron IPC，而是逐步把 IPC 变成 Runtime API adapter。

### 21.7 交付标准

1. Chat、Scheduler、IM 三类入口至少能通过 shared protocol 产生一致 runtime event。
2. Browser、Desktop/Visual、CLI、MCP、Skill 至少五类执行目标能通过统一 approval policy 评估。
3. CLI 长输出能截断并保存完整 artifact，UI 不因大输出卡死。
4. Plan Mode 能阻止写文件、提交表单和写命令类动作。
5. 任务 trace 能关联计划、动作、审批、输出、artifact、文件变更和最终结果。
6. `AGENTS.md` 加载结果能写入 trace，并在运行详情中可见。
7. 配置层具备 schema、默认值、读取失败回退和写入错误处理。
8. `TaskEngine` 至少拆出两个独立职责模块，并保持现有任务生命周期测试通过。

### 21.8 成功指标

| 指标 | 目标 |
| ---- | ---- |
| 跨入口事件一致性 | Chat / Scheduler / IM / MCP payload 收敛到 shared protocol |
| 审批覆盖率 | 高风险 browser / desktop / CLI / MCP / skill 动作均能产出审批决策 |
| Trace 完整率 | 成功和失败任务均能生成可复盘 trace |
| 长输出稳定性 | 大 stdout / stderr 不导致 UI 卡死或 store 过度膨胀 |
| Plan Mode 阻断率 | 写入类动作在 Plan Mode 下被阻止或要求切换模式 |
| 配置恢复能力 | 配置损坏时可回退默认值并产生 warning |

### 21.9 实施计划

| Week | 任务 | 交付物 |
| ---- | ---- | ------ |
| 1-2 | Shared protocol foundation | `src/shared/protocol/*`、核心事件类型、兼容测试 |
| 2-3 | Runtime API facade | `AgentRuntimeApi`、IPC adapter 初步迁移 |
| 3-4 | Unified approval policy | `ApprovalPolicyService`、统一审批对象、UI 适配 |
| 4-5 | Structured execution output | CLI / MCP / Skill / Browser 输出归一化、artifact 支持 |
| 5-6 | Plan Mode + Workspace Rules | Plan Mode 状态、`AGENTS.md` 加载、运行详情展示 |
| 6-7 | Trace / Diff / File Watcher | 运行轨迹、文件变更摘要、diff artifact |
| 7-8 | Runtime config + decomposition | 配置 schema、RuntimeConfigService、首批 coordinator 拆分 |
| 8-9 | 回归测试与文档 | 协议、审批、trace、配置、恢复测试与用户文档 |

### 21.10 对应技术规格

- 详细技术规格见：`docs/SPEC_P5_agent-runtime-platformization.md`

---

### Tips

> **参考项目**: [Hermes Agent - NousResearch](https://github.com/NousResearch/hermes-agent)
>
> Hermes Agent 是一个自改进的 AI agent，具有内置学习循环：
>
> - 从经验中创建 skills
> - 使用时自我改进 skills
> - 推动自身保存知识
> - 搜索历史会话
> - 跨会话建立用户模型
>
> 其 Skills 系统遵循 [agentskills.io](https://agentskills.io) 开放标准

---

_本文档最终解释权归产品团队所有_
