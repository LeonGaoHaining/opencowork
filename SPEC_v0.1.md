# OpenCowork MVP (v0.1) 技术规格说明书

| 项目 | 内容 |
|------|------|
| 版本 | v0.1 |
| 更新日期 | 2026-03-27 |
| 状态 | 正式版 |
| 基于PRD | v2.2 |

---

## 目录

1. [技术栈](#1-技术栈)
2. [项目结构](#2-项目结构)
3. [核心模块设计](#3-核心模块设计)
4. [Action Schema完整定义](#4-action-schema完整定义)
5. [UI组件规格](#5-ui组件规格)
6. [配置参数最佳实践](#6-配置参数最佳实践)
7. [IPC通信协议](#7-ipc通信协议)
8. [白名单配置](#8-白名单配置)
9. [性能要求](#9-性能要求)
10. [测试策略](#10-测试策略)
11. [里程碑](#11-里程碑)
12. [风险与应对](#12-风险与应对)

---

## 1. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Electron | ^28.0.0 |
| UI框架 | React | ^18.2.0 |
| 构建工具 | Vite | ^5.0.0 |
| 样式 | TailwindCSS | ^3.4.0 |
| 语言 | TypeScript | ^5.3.0 |
| 浏览器自动化 | Playwright | ^1.40.0 |
| LLM | OpenAI Responses API | - |
| 单元测试 | Vitest | ^1.2.0 |
| 组件测试 | @testing-library/react | ^14.1.0 |
| E2E测试 | Playwright | ^1.40.0 |
| 代码规范 | ESLint + Prettier | - |
| 状态管理 | Zustand | ^4.4.0 |
| 打包工具 | electron-builder | ^24.9.0 |

---

## 2. 项目结构

```
opencowork/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vite.config.main.ts      # 主进程Vite配置
├── vite.config.preload.ts   # 预加载Vite配置
├── tailwind.config.js
├── postcss.config.js
├── electron-builder.json
├── .eslintrc.cjs
├── .prettierrc
│
├── src/
│   ├── main/                   # Electron主进程
│   │   ├── index.ts           # 主进程入口
│   │   ├── window.ts          # 窗口管理
│   │   ├── ipc.ts             # IPC处理器
│   │   ├── menu.ts            # 菜单栏
│   │   ├── shortcuts.ts       # 全局快捷键
│   │   └── __tests__/
│   │       ├── window.test.ts
│   │       └── ipc.test.ts
│   │
│   ├── preload/                # 预加载脚本
│   │   ├── index.ts
│   │   └── __tests__/
│   │
│   ├── renderer/               # 渲染进程
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ChatUI.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ControlBar.tsx
│   │   │   ├── TaskStatus.tsx
│   │   │   ├── TakeoverModal.tsx
│   │   │   ├── PlanViewer.tsx
│   │   │   └── __tests__/
│   │   │       ├── ChatUI.test.tsx
│   │   │       └── ControlBar.test.tsx
│   │   ├── stores/
│   │   │   ├── taskStore.ts   # Zustand状态
│   │   │   └── uiStore.ts     # UI状态
│   │   │   └── __tests__/
│   │   ├── hooks/
│   │   │   ├── useTask.ts
│   │   │   ├── useTakeover.ts
│   │   │   └── __tests__/
│   │   ├── styles/
│   │   │   └── index.css
│   │   └── __tests__/
│   │
│   ├── core/                   # 核心业务逻辑
│   │   ├── executor/
│   │   │   ├── ExecutorRouter.ts
│   │   │   ├── BrowserExecutor.ts
│   │   │   ├── CLIExecutor.ts
│   │   │   └── __tests__/
│   │   │       ├── BrowserExecutor.test.ts
│   │   │       └── CLIExecutor.test.ts
│   │   │
│   │   ├── planner/
│   │   │   ├── TaskPlanner.ts
│   │   │   ├── PlanExecutor.ts
│   │   │   ├── PlanValidator.ts
│   │   │   ├── Replanner.ts
│   │   │   └── __tests__/
│   │   │       ├── TaskPlanner.test.ts
│   │   │       └── PlanExecutor.test.ts
│   │   │
│   │   ├── runtime/
│   │   │   ├── TaskEngine.ts
│   │   │   ├── TaskContext.ts
│   │   │   ├── TakeoverManager.ts
│   │   │   └── __tests__/
│   │   │       ├── TaskEngine.test.ts
│   │   │       └── TakeoverManager.test.ts
│   │   │
│   │   └── action/
│   │       ├── ActionSchema.ts
│   │       ├── ActionValidator.ts
│   │       └── __tests__/
│   │           └── ActionValidator.test.ts
│   │
│   ├── preview/
│   │   ├── PreviewManager.ts
│   │   ├── DetachedWindow.ts
│   │   └── __tests__/
│   │       └── PreviewManager.test.ts
│   │
│   ├── llm/
│   │   ├── LLMClient.ts
│   │   ├── OpenAIResponses.ts
│   │   ├── AnthropicClient.ts   # 预留扩展
│   │   ├── config.ts
│   │   └── __tests__/
│   │       └── LLMClient.test.ts
│   │
│   └── config/
│       ├── whitelist.ts
│       ├── default.ts
│       └── constants.ts
│
├── config/
│   └── llm.json                 # LLM配置（用户填入）
│
└── tests/
    └── e2e/
        ├── basic-flow.test.ts
        ├── takeover.test.ts
        └── cli.test.ts
```

---

## 3. 核心模块设计

### 3.1 TaskPlanner - 多轮任务规划器

#### 3.1.1 接口定义

```typescript
interface TaskPlanner {
  /**
   * 将自然语言任务分解为执行计划
   */
  plan(task: string, context: PlanContext): Promise<Plan>;
  
  /**
   * 根据执行结果重新规划
   */
  replan(request: ReplanRequest): Promise<ReplanResult>;
  
  /**
   * 验证计划可行性
   */
  validate(plan: Plan): ValidationResult;
}

interface PlanContext {
  currentUrl?: string;
  availableActions: ActionType[];
  previousResults?: Record<string, any>;
  userPreferences?: UserPrefs;
}

interface ReplanRequest {
  trigger: ReplanTrigger;
  failedNodeId?: string;
  error?: string;
  executionState: ExecutionState;
  remainingPlan: Plan;
}

enum ReplanTrigger {
  ACTION_FAILED = 'action_failed',
  ACTION_RESULT_UNRECOVERABLE = 'action_result_unrecoverable',
  USER_REQUEST = 'user_request',
  TIMEOUT = 'timeout',
  USER_RESUME = 'user_resume',
}
```

#### 3.1.2 规划Prompt

```typescript
const PLANNER_SYSTEM_PROMPT = `你是一个任务规划助手，负责将用户任务分解为可执行的步骤序列。

可用Action类型：
- browser:navigate(url) - 导航到URL
- browser:click(selector, index?) - 点击元素
- browser:input(selector, text, clear?) - 输入文本
- browser:wait(selector, timeout?) - 等待元素出现
- browser:extract(selector, type) - 提取页面数据
- browser:screenshot(fullPage?) - 页面截图
- cli:execute(command) - 执行CLI命令
- ask:user(question, options?) - 询问用户

重要规则：
1. 每个步骤必须对应一个可执行的Action
2. 对于复杂决策点，使用 ask:user 让用户确认
3. 考虑可能的失败情况，预设备用方案
4. 描述要简洁明确，便于用户理解

输出格式：JSON格式的Plan对象`;
```

### 3.2 PlanExecutor - 计划执行器

```typescript
interface PlanExecutor {
  /**
   * 执行计划
   */
  execute(plan: Plan, callbacks?: ExecutionCallbacks): AsyncGenerator<ExecutionEvent>;
  
  /**
   * 暂停执行
   */
  pause(): void;
  
  /**
   * 恢复执行
   */
  resume(): void;
  
  /**
   * 跳转到指定节点
   */
  jumpTo(nodeId: string): void;
  
  /**
   * 获取当前执行状态
   */
  getState(): ExecutionState;
}

interface ExecutionCallbacks {
  onNodeStart?: (node: PlanNode) => void;
  onNodeComplete?: (node: PlanNode, result: any) => void;
  onNodeError?: (node: PlanNode, error: Error) => void;
  onCondition?: (expression: string, result: boolean) => void;
  onLoopIteration?: (node: PlanNode, iteration: number) => void;
  onUserTakeover?: (node: PlanNode) => void;
}

type ExecutionEvent = 
  | { type: 'node_start'; node: PlanNode }
  | { type: 'node_complete'; node: PlanNode; result: any }
  | { type: 'node_error'; node: PlanNode; error: Error }
  | { type: 'condition_eval'; expression: string; result: boolean }
  | { type: 'loop_iteration'; node: PlanNode; iteration: number }
  | { type: 'paused'; node: PlanNode }
  | { type: 'resumed' }
  | { type: 'completed'; summary: any }
  | { type: 'failed'; error: Error };
```

### 3.3 TaskEngine - 任务引擎

```typescript
class TaskEngine {
  private planner: TaskPlanner;
  private executor: PlanExecutor;
  private takeoverManager: TakeoverManager;
  
  async startTask(task: string): Promise<TaskHandle> {
    // 1. 调用Planner生成Plan
    // 2. 创建TaskHandle
    // 3. 启动PlanExecutor
    // 4. 返回handle
  }
  
  async pause(handleId: string): Promise<void> {
    // 暂停执行
  }
  
  async resume(handleId: string): Promise<void> {
    // 恢复执行
  }
  
  async takeover(handleId: string): Promise<TakeoverContext> {
    // 返回接管上下文
  }
  
  async resumeFromUser(handleId: string, action: BaseAction): Promise<void> {
    // 执行用户指定的动作，然后继续
  }
  
  async cancel(handleId: string): Promise<void> {
    // 取消任务
  }
}

interface TaskHandle {
  id: string;
  status: TaskStatus;
  plan?: Plan;
  executionState?: ExecutionState;
  progress: { current: number; total: number };
  createdAt: number;
  updatedAt: number;
}

enum TaskStatus {
  PLANNING = 'planning',
  EXECUTING = 'executing',
  PAUSED = 'paused',
  WAITING_CONFIRM = 'waiting_confirm',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
```

### 3.4 TakeoverManager - 接管管理器

```typescript
class TakeoverManager {
  // 注册全局快捷键
  registerGlobalShortcuts(): void;
  
  // 注销快捷键
  unregisterAll(): void;
  
  // 触发接管
  triggerTakeover(reason: TakeoverReason): void;
  
  // 获取接管状态
  getTakeoverState(): TakeoverState | null;
  
  // 交还控制
  resumeFromTakeover(action?: BaseAction): void;
}

enum TakeoverReason {
  USER_KEYPRESS = 'user_keypress',      // ESC键
  USER_CLICK = 'user_click',           // 点击接管按钮
  USER_MOUSE = 'user_mouse',           // 检测到鼠标操作
  USER_REMOTE = 'user_remote',         // 手机远程命令
}

interface TakeoverState {
  reason: TakeoverReason;
  timestamp: number;
  currentNode: PlanNode;
  completedActions: BaseAction[];
  pendingNodes: PlanNode[];
  aiContext: {
    currentTask: string;
    conversationHistory: Message[];
    variables: Record<string, any>;
  };
}
```

---

## 4. Action Schema完整定义

### 4.1 Browser Actions (6个)

#### browser:navigate

```typescript
interface BrowserNavigateAction extends BaseAction {
  type: 'browser:navigate';
  params: {
    url: string;                          // 目标URL，必须是完整http/https
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  };
  constraints: {
    timeout: 30000;                       // 30秒超时
    retries: 2;                           // 最多重试2次
    requiresConfirm: false;
  };
}
```

#### browser:click

```typescript
interface BrowserClickAction extends BaseAction {
  type: 'browser:click';
  params: {
    selector: string;                     // CSS选择器或xpath
    index?: number;                       // 匹配多个时选择第几个，默认0
  };
  constraints: {
    timeout: 10000;                       // 10秒超时
    retries: 3;                           // 最多重试3次
    requiresConfirm: false;
  };
}
```

#### browser:input

```typescript
interface BrowserInputAction extends BaseAction {
  type: 'browser:input';
  params: {
    selector: string;                     // 输入框选择器
    text: string;                         // 输入文本
    clear?: boolean;                      // 输入前是否清空，默认true
    delay?: number;                       // 字符间延迟(ms)，默认0
  };
  constraints: {
    timeout: 10000;
    retries: 2;
    requiresConfirm: false;
  };
}
```

#### browser:wait

```typescript
interface BrowserWaitAction extends BaseAction {
  type: 'browser:wait';
  params: {
    selector?: string;                    // 等待元素出现
    timeout?: number;                      // 超时时间(ms)，默认10000
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
  };
  constraints: {
    timeout: 60000;                       // 最长等待60秒
    retries: 0;                           // 不重试
    requiresConfirm: false;
  };
}
```

#### browser:extract

```typescript
interface BrowserExtractAction extends BaseAction {
  type: 'browser:extract';
  params: {
    selector: string;                      // 提取元素选择器
    type: 'text' | 'html' | 'table' | 'json';
    multiple?: boolean;                    // 是否提取多个，默认false
  };
  constraints: {
    timeout: 15000;
    retries: 1;
    requiresConfirm: false;
  };
}
```

#### browser:screenshot

```typescript
interface BrowserScreenshotAction extends BaseAction {
  type: 'browser:screenshot';
  params: {
    fullPage?: boolean;                    // 是否截取整个页面，默认false
    selector?: string;                     // 指定元素截图
  };
  constraints: {
    timeout: 20000;
    retries: 1;
    requiresConfirm: false;
  };
}
```

### 4.2 Control Actions

#### ask:user

```typescript
interface AskUserAction extends BaseAction {
  type: 'ask:user';
  params: {
    question: string;                     // 询问问题
    options?: string[];                   // 选项列表
    defaultResponse?: string;              // 默认回答
  };
  constraints: {
    timeout: 300000;                      // 等待用户回答最多5分钟
    retries: 0;
    requiresConfirm: true;                // 强制需要确认
  };
}
```

### 4.3 CLI Actions

#### cli:execute

```typescript
interface CLIExecuteAction extends BaseAction {
  type: 'cli:execute';
  params: {
    command: string;                      // 命令内容
    workingDir?: string;                  // 工作目录
    env?: Record<string, string>;         // 环境变量
  };
  constraints: {
    timeout: 60000;                       // 60秒超时
    retries: 1;
    requiresConfirm: true;                 // 需确认
    whitelistOnly: true;                  // 白名单强制
  };
}
```

### 4.4 Action执行结果

```typescript
interface ActionResult {
  success: boolean;
  output?: any;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  screenshots?: string[];                 // 执行过程的截图
  duration: number;                       // 执行耗时(ms)
}
```

---

## 5. UI组件规格

### 5.1 全局样式

```css
:root {
  /* 主色调 */
  --color-primary: #6366F1;
  --color-primary-hover: #5558E3;
  --color-secondary: #8B5CF6;
  --color-accent: #22D3EE;
  
  /* 背景色 */
  --color-bg: #0F0F14;
  --color-surface: #1A1A24;
  --color-elevated: #252532;
  --color-border: #2E2E3A;
  
  /* 文字色 */
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #A1A1AA;
  --color-text-muted: #71717A;
  
  /* 状态色 */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  
  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  
  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  
  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}
```

### 5.2 字体

| 用途 | 字体 | 大小 | 字重 |
|------|------|------|------|
| 主文字 | Inter, system-ui, sans-serif | 14px | 400 |
| 标题 | Inter, system-ui, sans-serif | 16px | 600 |
| 按钮 | Inter, system-ui, sans-serif | 14px | 500 |
| 代码 | JetBrains Mono, Consolas, monospace | 13px | 400 |
| 状态文字 | Inter, system-ui, sans-serif | 12px | 400 |

### 5.3 组件样式

#### ChatMessage (用户消息)
```
- 右对齐
- 背景: var(--color-primary)
- 圆角: var(--radius-lg)
- 内边距: 12px 16px
- 最大宽度: 70%
```

#### ChatMessage (AI消息)
```
- 左对齐
- 背景: var(--color-surface)
- 圆角: var(--radius-lg)
- 内边距: 12px 16px
- 最大宽度: 80%
```

#### ChatInput
```
- 毛玻璃背景: rgba(255, 255, 255, 0.05)
- 边框: 1px solid var(--color-border)
- 聚焦边框: 1px solid var(--color-primary)
- 圆角: var(--radius-md)
- 高度: 48px
```

#### ControlBar按钮
```
- 背景: transparent
- 悬停背景: var(--color-elevated)
- 圆角: var(--radius-sm)
- 内边距: 8px 16px
- 字体: 14px, 500
```

#### TakeoverModal
```
- 居中显示
- 背景: var(--color-surface)
- 圆角: var(--radius-lg)
- 阴影: var(--shadow-lg)
- 内边距: 24px
- 遮罩: rgba(0, 0, 0, 0.7)
```

---

## 6. 配置参数最佳实践

### 6.1 LLM配置

```json
{
  "provider": "openai",
  "model": "gpt-4-turbo",
  "apiKey": "",
  "baseUrl": "https://api.openai.com/v1",
  "timeout": 60000,
  "maxRetries": 3,
  "temperature": 0.7
}
```

| 参数 | 建议值 | 说明 |
|------|--------|------|
| timeout | 60000ms | 60秒超时，适合复杂规划 |
| maxRetries | 3 | 失败最多重试3次 |
| temperature | 0.7 | 平衡创造性和确定性 |

### 6.2 任务引擎配置

```typescript
const TASK_ENGINE_CONFIG = {
  // 任务超时
  taskTimeout: 30 * 60 * 1000,        // 30分钟
  
  // 单个Action超时
  actionTimeout: {
    'browser:navigate': 30000,        // 30秒
    'browser:click': 10000,           // 10秒
    'browser:input': 10000,           // 10秒
    'browser:wait': 60000,            // 60秒
    'browser:extract': 15000,         // 15秒
    'browser:screenshot': 20000,      // 20秒
    'cli:execute': 60000,            // 60秒
    'ask:user': 300000,              // 5分钟
  },
  
  // 重试配置
  retry: {
    maxRetries: 3,
    backoff: 'exponential',          // 指数退避
    initialDelay: 1000,              // 初始延迟1秒
    maxDelay: 30000,                 // 最大延迟30秒
  },
  
  // 接管配置
  takeover: {
    escResponseTime: 50,             // ESC响应<50ms
    buttonResponseTime: 100,         // 按钮响应<100ms
  },
};
```

### 6.3 预览窗口配置

```typescript
const PREVIEW_CONFIG = {
  // 独立窗口默认值
  detached: {
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    title: 'OpenCowork - Browser Preview',
  },
  
  // 画面同步
  sync: {
    useCDP: true,                    // 使用CDP会话
    frameRate: 30,                   // 帧率
  },
};
```

### 6.4 CLI白名单配置

```typescript
const CLI_WHITELIST = {
  // 允许的命令及参数模式
  commands: {
    'git': {
      allowed: ['status', 'pull', 'push', 'clone', 'log', 'diff'],
      blockedArgs: ['--force'],     // 禁止的参数
    },
    'npm': {
      allowed: ['install', 'run', 'test', 'start', 'build'],
      blockedArgs: ['--force'],
    },
    'python': {
      allowed: ['-c', '-m', '*.py'],
      blockedArgs: [],
    },
    'curl': {
      allowed: ['-X GET', '-H', '-d', '--max-time'],
      blockedArgs: ['-f'],           // 禁止失败不报错
    },
    'node': {
      allowed: ['*.js'],
      blockedArgs: [],
    },
    'ls': {
      allowed: ['-la', '-l', '-a'],
      blockedArgs: [],
    },
    'pwd': {
      allowed: [],
      blockedArgs: [],
    },
    'echo': {
      allowed: ['*'],                // 允许任意参数
      blockedArgs: [],
    },
  },
  
  // 允许的路径
  paths: {
    '~/Documents': 'read-write',
    '~/Downloads': 'read-write',
    '/tmp': 'read-write',
    '/usr/bin': 'execute-only',
  },
  
  // 网络访问
  network: {
    allowedHosts: ['api.github.com', 'api.openai.com'],
    blockedPorts: [22, 3389, 3306, 5432],
    blockedIPs: [],                   // 阻止的IP列表
  },
  
  // 危险命令黑名单（完全禁止）
  blacklist: [
    'rm -rf',
    'dd',
    'mkfs',
    ':(){:|:&};:',                   // Fork炸弹
    'chmod -R 777',
  ],
};
```

---

## 7. IPC通信协议

### 7.1 IPC通道定义

```typescript
// 主进程暴露的IPC通道
export const IPC_CHANNELS = {
  // 任务相关
  TASK_START: 'task:start',
  TASK_PAUSE: 'task:pause',
  TASK_RESUME: 'task:resume',
  TASK_CANCEL: 'task:cancel',
  TASK_TAKEOVER: 'task:takeover',
  TASK_RESUME_FROM_USER: 'task:resumeFromUser',
  TASK_GET_STATE: 'task:getState',
  
  // 预览相关
  PREVIEW_SET_MODE: 'preview:setMode',
  PREVIEW_GET_STATE: 'preview:getState',
  
  // 配置相关
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  
  // 窗口相关
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
} as const;

// 渲染进程暴露的IPC通道
export const RENDERER_CHANNELS = {
  TASK_STATUS_UPDATE: 'task:statusUpdate',
  TASK_PROGRESS_UPDATE: 'task:progressUpdate',
  TASK_NODE_START: 'task:nodeStart',
  TASK_NODE_COMPLETE: 'task:nodeComplete',
  TASK_ERROR: 'task:error',
  TASK_PLAN_UPDATE: 'task:planUpdate',
  TASK_TAKEOVER_REQUEST: 'task:takeoverRequest',
  TASK_COMPLETED: 'task:completed',
} as const;
```

### 7.2 IPC消息格式

```typescript
interface IPCRequest<T = any> {
  channel: string;
  requestId: string;
  payload: T;
  timestamp: number;
}

interface IPCResponse<T = any> {
  channel: string;
  requestId: string;
  success: boolean;
  payload?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}
```

### 7.3 主进程IPC处理器

```typescript
// src/main/ipc.ts
export function setupIPCHandlers() {
  // 任务启动
  ipcMain.handle(IPC_CHANNELS.TASK_START, async (event, { task }) => {
    const handle = await taskEngine.startTask(task);
    return { handle };
  });
  
  // 任务暂停
  ipcMain.handle(IPC_CHANNELS.TASK_PAUSE, async (event, { handleId }) => {
    await taskEngine.pause(handleId);
    return { success: true };
  });
  
  // 任务接管
  ipcMain.handle(IPC_CHANNELS.TASK_TAKEOVER, async (event, { handleId }) => {
    const context = await taskEngine.takeover(handleId);
    return { context };
  });
  
  // 任务交还
  ipcMain.handle(IPC_CHANNELS.TASK_RESUME_FROM_USER, async (event, { handleId, action }) => {
    await taskEngine.resumeFromUser(handleId, action);
    return { success: true };
  });
}
```

---

## 8. 白名单配置

### 8.1 命令白名单

| 命令 | 允许的子命令 | 说明 |
|------|-------------|------|
| git | status, pull, push, clone, log, diff | 版本控制 |
| npm | install, run, test, start, build | Node.js包管理 |
| python | -c, -m, *.py | Python解释器 |
| curl | -X GET, -H, -d, --max-time | HTTP请求 |
| node | *.js | Node.js运行时 |
| ls | -la, -l, -a | 目录列表 |
| pwd | - | 当前目录 |
| echo | * | 输出文本 |

### 8.2 路径白名单

| 路径 | 权限 | 说明 |
|------|------|------|
| ~/Documents | read-write | 用户文档 |
| ~/Downloads | read-write | 下载目录 |
| /tmp | read-write | 临时文件 |
| /usr/bin | execute-only | 系统命令 |

### 8.3 网络白名单

| 类型 | 值 |
|------|------|
| allowedHosts | api.github.com, api.openai.com |
| blockedPorts | 22, 3389, 3306, 5432 |

### 8.4 黑名单命令（完全禁止）

```
rm -rf
dd
mkfs
chmod -R 777
fork炸弹等危险命令
```

---

## 9. 性能要求

### 9.1 启动性能

| 指标 | 目标 | 说明 |
|------|------|------|
| 冷启动时间 | < 5s | 应用启动到可交互 |
| 热启动时间 | < 1s | 再次打开 |
| 预览窗口启动 | < 2s | 独立窗口打开 |

### 9.2 执行性能

| Action类型 | 目标延迟 | 最大延迟 |
|------------|----------|----------|
| browser:navigate | < 3s | 10s |
| browser:click | < 500ms | 3s |
| browser:input | < 200ms | 1s |
| browser:wait | < 1s | 60s |
| browser:extract | < 1s | 5s |
| browser:screenshot | < 1s | 5s |
| cli:execute | < 2s | 60s |

### 9.3 任务规划性能

| 场景 | 目标延迟 | 最大延迟 |
|------|----------|----------|
| 简单任务（<5步） | < 2s | 5s |
| 复杂任务（5-15步） | < 5s | 15s |
| 包含条件分支 | < 8s | 20s |

### 9.4 接管响应

| 触发方式 | 目标响应 | 最大响应 |
|----------|----------|----------|
| ESC键 | < 50ms | 100ms |
| 接管按钮 | < 100ms | 200ms |
| 鼠标操作检测 | < 100ms | 200ms |

### 9.5 资源占用

| 指标 | 目标 | 最大 |
|------|------|------|
| 内存（空闲） | < 500MB | 1GB |
| 内存（执行中） | < 1GB | 2GB |
| CPU空闲 | < 5% | 10% |
| CPU执行中 | < 30% | 50% |

---

## 10. 测试策略

### 10.1 测试覆盖率目标

| 模块 | 覆盖率目标 | 重要测试用例 |
|------|------------|--------------|
| TaskPlanner | ≥ 80% | 任务分解、条件分支、循环、失败重试 |
| PlanExecutor | ≥ 80% | 节点执行、条件跳转、循环迭代、错误处理 |
| TaskEngine | ≥ 75% | 生命周期、状态转换、并发处理 |
| BrowserExecutor | ≥ 70% | 6个Action、错误恢复、超时处理 |
| CLIExecutor | ≥ 70% | 白名单验证、命令执行、输出解析 |
| TakeoverManager | ≥ 80% | 快捷键、状态保存、交还控制 |

### 10.2 单元测试示例

```typescript
// src/core/planner/__tests__/TaskPlanner.test.ts
describe('TaskPlanner', () => {
  describe('plan()', () => {
    it('should decompose simple task into steps', async () => {
      const planner = new TaskPlanner(mockLLMClient);
      const plan = await planner.plan('打开Google并搜索OpenCowork');
      
      expect(plan.nodes.length).toBeGreaterThan(0);
      expect(plan.nodes[0].action.type).toBe('browser:navigate');
      expect(plan.nodes[1].action.type).toBe('browser:input');
    });
    
    it('should create condition node for price comparison', async () => {
      // ...
    });
    
    it('should create loop node for pagination', async () => {
      // ...
    });
  });
});
```

### 10.3 E2E测试场景

```typescript
// tests/e2e/basic-flow.test.ts
describe('Basic Task Flow', () => {
  it('should complete multi-step task with browser automation', async () => {
    // 1. 启动应用
    await app.launch();
    
    // 2. 输入任务
    await page.fill('[data-testid="chat-input"]', '打开Google并搜索OpenCowork');
    await page.click('[data-testid="send-button"]');
    
    // 3. 等待任务开始
    await expect(page.locator('[data-testid="task-status"]')).toContainText('执行中');
    
    // 4. 验证步骤执行
    await expect(page.locator('[data-testid="progress"]')).toContainText('1/3');
    
    // 5. 等待任务完成
    await expect(page.locator('[data-testid="task-status"]')).toContainText('完成');
  });
});
```

---

## 11. 里程碑

### Week 1-2: 项目初始化

| 任务 | 交付 | 状态 |
|------|------|------|
| Electron + React + Vite项目搭建 | ✅ | |
| TypeScript + ESLint + Prettier配置 | ✅ | |
| TailwindCSS配置 | ✅ | |
| 基础窗口管理（主窗口+预览窗口） | ✅ | |
| IPC通信骨架 | ✅ | |
| Zustand状态管理搭建 | ✅ | |
| Vitest测试环境配置 | ✅ | |

### Week 3-4: TaskPlanner

| 任务 | 交付 | 状态 |
|------|------|------|
| LLM客户端接入（OpenAI Responses API） | ✅ | |
| Action Schema定义 | ✅ | |
| TaskPlanner核心逻辑 | ✅ | |
| Plan类型定义 | ✅ | |
| 条件分支支持 | ✅ | |
| 循环支持 | ✅ | |
| TaskPlanner单元测试 | ✅ | |

### Week 5-6: PlanExecutor + TaskEngine

| 任务 | 交付 | 状态 |
|------|------|------|
| PlanExecutor核心逻辑 | ✅ | |
| 节点执行引擎 | ✅ | |
| TaskEngine任务管理 | ✅ | |
| 失败重试机制 | ✅ | |
| Replanner动态重规划 | ✅ | |
| TakeoverManager接管机制 | ✅ | |
| ESC快捷键监听 | ✅ | |
| 执行引擎单元测试 | ✅ | |

### Week 6-7: Browser Executor

| 任务 | 交付 | 状态 |
|------|------|------|
| Playwright集成 | ✅ | |
| browser:navigate | ✅ | |
| browser:click | ✅ | |
| browser:input | ✅ | |
| browser:wait | ✅ | |
| browser:extract | ✅ | |
| browser:screenshot | ✅ | |
| CLI Executor | ✅ | |
| Executor单元测试 | ✅ | |

### Week 7-8: UI + 预览 + 集成

| 任务 | 交付 | 状态 |
|------|------|------|
| ChatUI组件 | ✅ | |
| ControlBar组件 | ✅ | |
| TaskStatus组件 | ✅ | |
| TakeoverModal组件 | ✅ | |
| PlanViewer组件 | ✅ | |
| PreviewManager独立窗口 | ✅ | |
| UI与核心模块集成 | ✅ | |
| E2E测试 | ✅ | |
| Bug修复 | ✅ | |
| MVP交付 | ✅ | |

---

## 12. 风险与应对

### 12.1 高风险

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| LLM规划质量不稳定 | 中 | 高 | 预设fallback策略，失败时使用简单规划 |
| Browser自动化不稳定 | 高 | 高 | Playwright内置重试，详细错误日志 |
| ESC快捷键冲突 | 低 | 中 | 可配置快捷键，优先使用按钮接管 |

### 12.2 中风险

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 多窗口状态同步 | 中 | 中 | 使用IPC统一管理，状态广播 |
| 内存泄漏 | 低 | 中 | 及时释放BrowserContext，定期监控 |
| 白名单安全漏洞 | 低 | 高 | 严格验证，禁止动态命令拼接 |

### 12.3 低风险

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 性能问题 | 低 | 低 | 性能监控，按需优化 |
| UI兼容性 | 低 | 低 | 使用标准Web API，跨浏览器测试 |

---

## 附录

### A. 环境变量

```bash
# .env.local
VITE_APP_NAME=OpenCowork
VITE_APP_VERSION=0.1.0

# 生产环境
NODE_ENV=production
```

### B. Git提交规范

```
<type>(<scope>): <subject>

types: feat, fix, docs, style, refactor, test, chore
```

### C. 关键依赖版本锁定

```json
{
  "electron": "^28.0.0",
  "react": "^18.2.0",
  "playwright": "^1.40.0",
  "vitest": "^1.2.0",
  "typescript": "^5.3.0"
}
```

---

*文档版本: v0.1*
*最后更新: 2026-03-27*
