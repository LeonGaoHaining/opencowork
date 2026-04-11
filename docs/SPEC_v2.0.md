# SPEC v2.0 - 完整浏览器详细技术规格

> 版本: v2.0  
> 更新日期: 2026-04-09  
> 状态: 规划中

---

## 目录

1. [概述](#1-概述)
2. [技术架构](#2-技术架构)
3. [模块设计](#3-模块设计)
4. [接口定义](#4-接口定义)
5. [数据模型](#5-数据模型)
6. [实施计划](#6-实施计划)
7. [验收标准](#7-验收标准)

---

## 1. 概述

### 1.1 版本目标

将浏览器预览区升级为**真实浏览器**，通过 Playwright CDP 连接实现 AI 与用户共享同一浏览器实例。

### 1.2 核心功能

| 功能            | 优先级 | 说明                         |
| --------------- | ------ | ---------------------------- |
| 真实浏览器      | P0     | BrowserWindow 替代截图预览   |
| 完整地址栏      | P0     | URL 显示、可编辑、可导航     |
| 前进/后退       | P0     | 浏览历史导航                 |
| 刷新/停止       | P0     | 页面刷新、加载中断           |
| AI/用户同时操作 | P0     | 两者可同时操控同一浏览器     |
| 同步状态指示    | P1     | 显示当前谁在操作             |
| 三种预览模式    | P1     | Sidebar/Collapsible/Detached |

### 1.3 技术约束

1. **BrowserWindow vs BrowserView**: BrowserView 无法被 Playwright 控制，必须使用 BrowserWindow
2. **CDP 连接**: Playwright 通过 Chrome DevTools Protocol (CDP) 端口 9222 连接 BrowserWindow
3. **三种模式**: Sidebar/Collapsible/Detached 都基于 BrowserWindow 实现

---

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron Main Process                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐      ┌──────────────────────────────┐│
│  │   PreviewManager     │      │   BrowserExecutor (Playwright)││
│  │                      │      │                              ││
│  │  • BrowserWindow     │      │  • CDP 连接到 BrowserWindow   ││
│  │  • 工具栏 (内部)     │◄────►│  • Agent 通过 CDP 控制页面   ││
│  │  • 三种模式管理      │ CDP  │                              ││
│  │  • 用户交互事件      │ 9222 │                              ││
│  └──────────────────────┘      └──────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户操作 BrowserWindow
    ↓ DOM 事件
BrowserWindow.webContents
    ↓ IPC
Main Process (PreviewManager)
    ↓ CDP
Playwright BrowserExecutor
    ↓ Action 执行
BrowserWindow 页面更新
    ↓
Agent 看到更新后的页面
```

### 2.3 组件关系

```
┌─────────────────────────────────────────────────────────────────┐
│                         Renderer Process                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  preview.tsx │    │ ControlBar   │    │   App.tsx    │     │
│  │  (预览组件)   │    │ (控制栏)     │    │  (主应用)     │     │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘     │
│         │                   │                                   │
│         └─────────┬─────────┘                                   │
│                   ▼                                             │
│         ┌────────────────┐                                      │
│         │  IPC Bridge    │                                      │
│         │ (ipcRenderer)  │                                      │
│         └────────┬───────┘                                      │
└──────────────────┼──────────────────────────────────────────────┘
                   │
┌──────────────────┼──────────────────────────────────────────────┐
│                  ▼           Main Process                        │
│         ┌────────────────┐                                      │
│         │   IPC Handlers │                                      │
│         └────────┬───────┘                                      │
│                  │                                              │
│    ┌─────────────┴─────────────┐                                │
│    ▼                             ▼                              │
│  ┌──────────────┐       ┌──────────────┐                       │
│  │PreviewManager│       │BrowserExecutor│                      │
│  │(窗口管理)    │◄─────►│(CDP控制)      │                       │
│  └──────────────┘       └──────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 模块设计

### 3.1 PreviewManager

#### 3.1.1 职责

- 管理 BrowserWindow 的创建、销毁、模式切换
- 处理工具栏用户交互事件
- 与 BrowserExecutor 协调 CDP 连接

#### 3.1.2 类定义

```typescript
import { BrowserWindow } from 'electron';
import { BrowserExecutor } from '../executor/BrowserExecutor';

export enum PreviewMode {
  SIDEBAR = 'sidebar', // 侧边预览
  COLLAPSIBLE = 'collapsible', // 可折叠
  DETACHED = 'detached', // 独立窗口
}

export enum SyncStatus {
  IDLE = 'idle', // Agent 空闲
  AGENT_WORKING = 'agent_working', // Agent 操作中
  USER_WORKING = 'user_working', // 用户操作中
}

export interface PreviewConfig {
  sidebar: {
    width: number; // 默认 500
  };
  collapsible: {
    collapsedHeight: number; // 默认 40
    expandedHeightRatio: number; // 默认 0.6
  };
  detached: {
    defaultWidth: number; // 默认 1024
    defaultHeight: number; // 默认 768
  };
  cdpPort: number; // 默认 9222
}

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
  cdpPort: 9222,
};

export class PreviewManager {
  private config: PreviewConfig;
  private mainWindow: BrowserWindow | null = null;
  private browserWindow: BrowserWindow | null = null;
  private browserExecutor: BrowserExecutor | null = null;

  private mode: PreviewMode = PreviewMode.SIDEBAR;
  private syncStatus: SyncStatus = SyncStatus.IDLE;
  private isDestroyed: boolean = false;

  constructor(config: Partial<PreviewConfig> = {}) {
    this.config = { ...DEFAULT_PREVIEW_CONFIG, ...config };
  }

  async initialize(mainWindow: BrowserWindow, browserExecutor: BrowserExecutor): Promise<void>;
  async setMode(mode: PreviewMode): Promise<void>;
  async navigateTo(url: string): Promise<void>;
  async goBack(): Promise<void>;
  async goForward(): Promise<void>;
  async reload(): Promise<void>;
  async stop(): Promise<void>;
  setSyncStatus(status: SyncStatus): void;
  getSyncStatus(): SyncStatus;
  getBrowserWindow(): BrowserWindow | null;
  cleanup(): void;
}
```

#### 3.1.3 方法实现

```typescript
// 初始化
async initialize(mainWindow: BrowserWindow, browserExecutor: BrowserExecutor): Promise<void> {
  this.mainWindow = mainWindow;
  this.browserExecutor = browserExecutor;

  // 创建 BrowserWindow
  await this.createBrowserWindow();

  // 连接 CDP
  await this.connectCDP();
}

// 创建 BrowserWindow
private async createBrowserWindow(): Promise<void> {
  const bounds = this.mainWindow?.getBounds();

  this.browserWindow = new BrowserWindow({
    width: this.config.sidebar.width,
    height: bounds?.height || 720,
    show: false,
    frame: false, // 无边框，工具栏在内部
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:automation', // 与 Playwright 共享
    },
  });

  // 绑定工具栏事件
  this.bindToolbarEvents();
}

// CDP 连接
private async connectCDP(): Promise<void> {
  if (!this.browserExecutor || !this.browserWindow) {
    throw new Error('BrowserExecutor or BrowserWindow not initialized');
  }

  // Playwright 通过 CDP 连接到 BrowserWindow
  await this.browserExecutor.connectToWindow(this.browserWindow, this.config.cdpPort);
}

// 侧边预览模式
private async enableSidebarMode(): Promise<void> {
  if (!this.mainWindow || !this.browserWindow) return;

  const mainBounds = this.mainWindow.getBounds();

  this.browserWindow.setBounds({
    x: mainBounds.width - this.config.sidebar.width,
    y: 0,
    width: this.config.sidebar.width,
    height: mainBounds.height,
  });

  if (!this.browserWindow.isVisible()) {
    this.browserWindow.show();
  }
}

// 可折叠预览模式
private async enableCollapsibleMode(): Promise<void> {
  if (!this.mainWindow || !this.browserWindow) return;

  const mainBounds = this.mainWindow.getBounds();
  const expanded = this.isExpanded; // 内部状态

  if (expanded) {
    this.browserWindow.setBounds({
      x: 0,
      y: 0,
      width: mainBounds.width,
      height: Math.floor(mainBounds.height * this.config.collapsible.expandedHeightRatio),
    });
  } else {
    this.browserWindow.setBounds({
      x: 0,
      y: 0,
      width: mainBounds.width,
      height: this.config.collapsible.collapsedHeight,
    });
  }
}

// 独立窗口模式
private async enableDetachedMode(): Promise<void> {
  if (this.browserWindow) {
    this.browserWindow.setBounds({
      x: 100,
      y: 100,
      width: this.config.detached.defaultWidth,
      height: this.config.detached.defaultHeight,
    });
    this.browserWindow.show();
  }
}

// 工具栏事件绑定
private bindToolbarEvents(): void {
  if (!this.browserWindow) return;

  const webContents = this.browserWindow.webContents;

  // 地址栏回车导航
  webContents.on('ipc-message', (channel, ...args) => {
    if (channel === 'toolbar:navigate') {
      const url = args[0];
      this.navigateTo(url);
    }
  });

  // 地址栏变化监听
  webContents.on('did-navigate', (event, url) => {
    // 通知主窗口更新地址栏显示
    this.mainWindow?.webContents.send('browser:urlChanged', url);
  });

  // 用户交互检测
  webContents.on('input-event', (event, input) => {
    if (input.type === 'mouseDown' || input.type === 'keyDown') {
      this.setSyncStatus(SyncStatus.USER_WORKING);
    }
  });
}
```

### 3.2 BrowserExecutor CDP 连接

#### 3.2.1 职责

- 通过 CDP 端口连接到 BrowserWindow
- 执行 Agent 的浏览器操作
- 监听页面变化并同步状态

#### 3.2.2 类定义

```typescript
import { Browser, BrowserContext, Page } from 'playwright';

export interface CDPConnectionOptions {
  port: number;
  timeout: number;
}

export class BrowserExecutor {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private cdpSession: any = null;
  private isConnected: boolean = false;

  // 原有方法
  async launchBrowser(): Promise<void>;
  async execute(action: BrowserAction): Promise<ActionResult>;
  async cleanup(): Promise<void>;

  // CDP 连接新方法
  async connectToWindow(window: BrowserWindow, port: number = 9222): Promise<void>;
  async disconnectFromWindow(): Promise<void>;
  isCDPConnected(): boolean;
}
```

#### 3.2.3 CDP 连接实现

```typescript
// 连接 BrowserWindow
async connectToWindow(window: BrowserWindow, port: number = 9222): Promise<void> {
  try {
    // 使用 Playwright 的 CDP 连接功能
    // connectOverCDP 连接到已运行的 Chrome 实例
    const browserWSEndpoint = `http://localhost:${port}`;

    this.browser = await chromium.connectOverCDP(browserWSEndpoint);

    // 获取 BrowserWindow 对应的 context
    const contexts = this.browser.contexts();
    if (contexts.length > 0) {
      this.context = contexts[0];

      // 获取页面
      const pages = this.context.pages();
      this.page = pages[0] || await this.context.newPage();
    }

    this.isConnected = true;
    console.log('[BrowserExecutor] Connected to BrowserWindow via CDP');
  } catch (error) {
    console.error('[BrowserExecutor] CDP connection failed:', error);
    throw error;
  }
}

// 断开连接
async disconnectFromWindow(): Promise<void> {
  if (this.browser) {
    await this.browser.close();
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isConnected = false;
    console.log('[BrowserExecutor] Disconnected from BrowserWindow');
  }
}

// 监听页面变化
private setupPageListeners(): void {
  if (!this.page) return;

  // 页面导航
  this.page.on('framenavigated', (frame) => {
    if (frame === this.page?.mainFrame()) {
      console.log('[BrowserExecutor] Page navigated:', frame.url());
    }
  });

  // DOM 变化
  this.page.on('domcontentloaded', () => {
    console.log('[BrowserExecutor] DOM loaded');
  });
}
```

### 3.3 工具栏组件

#### 3.3.1 职责

- 显示在 BrowserWindow 内部顶部
- 提供地址栏和导航按钮
- 显示同步状态

#### 3.3.2 HTML 结构

```html
<!-- 工具栏 HTML (内嵌在 BrowserWindow 中) -->
<div id="browser-toolbar">
  <div class="toolbar-left">
    <button id="btn-back" title="后退">←</button>
    <button id="btn-forward" title="前进">→</button>
    <button id="btn-reload" title="刷新">↻</button>
    <button id="btn-stop" title="停止">×</button>
  </div>

  <div class="toolbar-center">
    <input type="text" id="url-input" placeholder="输入网址后回车跳转" />
  </div>

  <div class="toolbar-right">
    <span id="sync-status" class="status-idle">● 就绪</span>
  </div>
</div>

<style>
  #browser-toolbar {
    display: flex;
    align-items: center;
    height: 40px;
    background: #1a1a24;
    border-bottom: 1px solid #333;
    padding: 0 8px;
  }

  .toolbar-left button {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: #fff;
    cursor: pointer;
    border-radius: 4px;
  }

  .toolbar-left button:hover {
    background: #333;
  }

  .toolbar-center {
    flex: 1;
    margin: 0 8px;
  }

  #url-input {
    width: 100%;
    height: 28px;
    background: #0f0f14;
    border: 1px solid #333;
    border-radius: 4px;
    color: #fff;
    padding: 0 12px;
  }

  #url-input:focus {
    border-color: #6366f1;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
  }

  #sync-status {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .status-idle {
    color: #10b981;
  }
  .status-agent {
    color: #22d3ee;
  }
  .status-user {
    color: #f59e0b;
  }
</style>
```

#### 3.3.3 JavaScript 交互

```javascript
// 工具栏交互脚本
document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('btn-back');
  const forwardBtn = document.getElementById('btn-forward');
  const reloadBtn = document.getElementById('btn-reload');
  const stopBtn = document.getElementById('btn-stop');
  const urlInput = document.getElementById('url-input');
  const syncStatus = document.getElementById('sync-status');

  // 发送 IPC 到主进程
  const sendIPC = (channel, ...args) => {
    window.electron?.send(channel, ...args);
  };

  // 后退
  backBtn.addEventListener('click', () => sendIPC('browser:goBack'));

  // 前进
  forwardBtn.addEventListener('click', () => sendIPC('browser:goForward'));

  // 刷新
  reloadBtn.addEventListener('click', () => sendIPC('browser:reload'));

  // 停止
  stopBtn.addEventListener('click', () => sendIPC('browser:stop'));

  // 地址栏导航
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      let url = urlInput.value.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      sendIPC('browser:navigate', url);
    }
  });

  // 监听页面导航事件，更新地址栏
  window.electron?.on('browser:urlChanged', (url) => {
    urlInput.value = url;
  });

  // 监听同步状态更新
  window.electron?.on('browser:syncStatusChanged', (status) => {
    const statusMap = {
      idle: { text: '● 就绪', class: 'status-idle' },
      agent_working: { text: '● Agent 工作中', class: 'status-agent' },
      user_working: { text: '● 等待同步', class: 'status-user' },
    };
    syncStatus.textContent = statusMap[status].text;
    syncStatus.className = statusMap[status].class;
  });
});
```

### 3.4 IPC 通信

#### 3.4.1 Browser 相关 IPC

```typescript
// src/main/ipc.ts

// 注册 Browser IPC
ipcMain.handle('browser:navigate', async (event, url: string) => {
  const previewManager = getPreviewManager();
  await previewManager.navigateTo(url);
  return { success: true };
});

ipcMain.handle('browser:goBack', async () => {
  const previewManager = getPreviewManager();
  await previewManager.goBack();
  return { success: true };
});

ipcMain.handle('browser:goForward', async () => {
  const previewManager = getPreviewManager();
  await previewManager.goForward();
  return { success: true };
});

ipcMain.handle('browser:reload', async () => {
  const previewManager = getPreviewManager();
  await previewManager.reload();
  return { success: true };
});

ipcMain.handle('browser:stop', async () => {
  const previewManager = getPreviewManager();
  await previewManager.stop();
  return { success: true };
});

ipcMain.handle('browser:setMode', async (event, mode: PreviewMode) => {
  const previewManager = getPreviewManager();
  await previewManager.setMode(mode);
  return { success: true };
});

ipcMain.handle('browser:getStatus', async () => {
  const previewManager = getPreviewManager();
  return {
    success: true,
    data: {
      mode: previewManager.getMode(),
      syncStatus: previewManager.getSyncStatus(),
    },
  };
});
```

---

## 4. 接口定义

### 4.1 PreviewManager API

```typescript
interface IPreviewManager {
  // 初始化
  initialize(mainWindow: BrowserWindow, browserExecutor: BrowserExecutor): Promise<void>;

  // 模式管理
  setMode(mode: PreviewMode): Promise<void>;
  getMode(): PreviewMode;

  // 导航控制
  navigateTo(url: string): Promise<void>;
  goBack(): Promise<void>;
  goForward(): Promise<void>;
  reload(): Promise<void>;
  stop(): Promise<void>;

  // 状态管理
  setSyncStatus(status: SyncStatus): void;
  getSyncStatus(): SyncStatus;

  // 窗口访问
  getBrowserWindow(): BrowserWindow | null;

  // 清理
  cleanup(): void;
}
```

### 4.2 BrowserExecutor CDP API

```typescript
interface IBrowserExecutorCDP {
  // CDP 连接
  connectToWindow(window: BrowserWindow, port?: number): Promise<void>;
  disconnectFromWindow(): Promise<void>;
  isCDPConnected(): boolean;

  // 原有方法
  execute(action: BrowserAction): Promise<ActionResult>;
  cleanup(): Promise<void>;
}
```

### 4.3 前端 API

```typescript
// Renderer 调用接口
interface BrowserAPI {
  navigate(url: string): Promise<void>;
  goBack(): Promise<void>;
  goForward(): Promise<void>;
  reload(): Promise<void>;
  stop(): Promise<void>;
  setMode(mode: PreviewMode): Promise<void>;
  getStatus(): Promise<{ mode: PreviewMode; syncStatus: SyncStatus }>;
}

// 使用示例
const browserAPI = window.electron;

// 导航
await browserAPI.invoke('browser:navigate', 'https://www.example.com');

// 后退
await browserAPI.invoke('browser:goForward');

// 获取状态
const status = await browserAPI.invoke('browser:getStatus');
console.log(status.data.syncStatus); // 'idle' | 'agent_working' | 'user_working'
```

---

## 5. 数据模型

### 5.1 PreviewMode

```typescript
enum PreviewMode {
  SIDEBAR = 'sidebar', // 侧边预览（默认）
  COLLAPSIBLE = 'collapsible', // 可折叠
  DETACHED = 'detached', // 独立窗口
}
```

### 5.2 SyncStatus

```typescript
enum SyncStatus {
  IDLE = 'idle', // Agent 空闲
  AGENT_WORKING = 'agent_working', // Agent 操作中
  USER_WORKING = 'user_working', // 用户操作中
}
```

### 5.3 PreviewConfig

```typescript
interface PreviewConfig {
  sidebar: {
    width: number; // 侧边宽度，默认 500
  };
  collapsible: {
    collapsedHeight: number; // 收起高度，默认 40
    expandedHeightRatio: number; // 展开比例，默认 0.6
  };
  detached: {
    defaultWidth: number; // 独立窗口宽度，默认 1024
    defaultHeight: number; // 独立窗口高度，默认 768
  };
  cdpPort: number; // CDP 端口，默认 9222
}
```

---

## 6. 实施计划

### 6.1 Week 1-2: PreviewManager 重构

| 任务                   | 交付物                            | 优先级 |
| ---------------------- | --------------------------------- | ------ |
| BrowserWindow 创建逻辑 | BrowserWindow 替代 BrowserView    | P0     |
| 三种模式框架           | setMode() 方法实现                | P0     |
| 窗口位置计算           | Sidebar/Collapsible/Detached 布局 | P1     |

### 6.2 Week 2-3: 工具栏组件

| 任务            | 交付物         | 优先级 |
| --------------- | -------------- | ------ |
| 工具栏 HTML/CSS | 内嵌工具栏界面 | P0     |
| 导航按钮事件    | ←→↻× 按钮功能  | P0     |
| 地址栏交互      | URL 输入和导航 | P0     |
| 同步状态显示    | 状态指示器     | P1     |

### 6.3 Week 3-4: CDP 连接集成

| 任务            | 交付物                   | 优先级 |
| --------------- | ------------------------ | ------ |
| CDP 连接实现    | connectToWindow() 方法   | P0     |
| Playwright 集成 | BrowserExecutor CDP 模式 | P0     |
| 页面事件监听    | 导航/DOM 变化监听        | P1     |

### 6.4 Week 4-5: 三种模式实现

| 任务             | 交付物             | 优先级 |
| ---------------- | ------------------ | ------ |
| Sidebar 模式     | 侧边栏附加到主窗口 | P0     |
| Collapsible 模式 | 可折叠/展开功能    | P0     |
| Detached 模式    | 独立窗口功能       | P0     |

### 6.5 Week 5-6: 状态同步 + 测试

| 任务         | 交付物                 | 优先级 |
| ------------ | ---------------------- | ------ |
| 同步状态逻辑 | Agent/用户操作状态切换 | P0     |
| 端到端测试   | 完整功能测试           | P0     |
| 性能优化     | 加载速度优化           | P1     |
| Bug 修复     | 问题修复               | P1     |

---

## 7. 验收标准

### 7.1 功能验收

| 功能               | 验收条件                          |
| ------------------ | --------------------------------- |
| BrowserWindow 创建 | 预览打开时 BrowserWindow 正常显示 |
| 地址栏导航         | 输入 URL 回车后页面跳转           |
| 前进/后退          | 点击按钮后页面正确导航            |
| 刷新/停止          | 点击后页面刷新/停止加载           |
| 三种模式切换       | 模式切换后窗口布局正确            |
| 同步状态显示       | Agent 操作时显示对应状态          |

### 7.2 性能验收

| 指标         | 目标    |
| ------------ | ------- |
| 页面加载延迟 | < 2s    |
| 导航响应延迟 | < 500ms |
| 状态切换延迟 | < 100ms |

### 7.3 兼容性验收

| 平台    | 要求          |
| ------- | ------------- |
| Windows | Windows 10+   |
| macOS   | macOS 11+     |
| Linux   | Ubuntu 20.04+ |

---

## 附录

### A. 相关文件

| 文件                                   | 说明           |
| -------------------------------------- | -------------- |
| `src/preview/PreviewManager.ts`        | 预览管理器主类 |
| `src/core/executor/BrowserExecutor.ts` | 浏览器执行器   |
| `src/main/ipcHandlers.ts`              | IPC 处理器     |
| `src/renderer/components/preview.tsx`  | 预览组件       |

### B. 参考资料

| 资料                     | 说明                     |
| ------------------------ | ------------------------ |
| Electron BrowserWindow   | 窗口管理 API             |
| Playwright CDP           | Chrome DevTools Protocol |
| Chrome DevTools Protocol | 调试协议文档             |

---

_本文档最终解释权归产品团队所有_
