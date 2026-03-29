# OpenCowork v0.2 技术规格说明书

| 项目 | 内容 |
|------|------|
| 版本 | v0.2 |
| 更新日期 | 2026-03-28 |
| 状态 | 草稿 |
| 基于PRD | v2.2 |
| 前置版本 | v0.1 (MVP) |

---

## 目录

1. [版本目标](#1-版本目标)
2. [遗留事项与改进](#2-遗留事项与改进)
3. [核心模块设计](#3-核心模块设计)
4. [Action Schema扩展](#4-action-schema扩展)
5. [UI组件规格](#5-ui组件规格)
6. [里程碑](#6-里程碑)

---

## 1. 版本目标

**目标**：修复 v0.1 遗留问题，提升稳定性和功能完整性

| 目标 | 说明 |
|------|------|
| 用户交互完整 | 实现 ask:user 完整功能 |
| 失败恢复 | 实现 Replanner 动态重规划 |
| Selector稳定性 | 改进 LLM 生成的 CSS 选择器 |
| 预览模式增强 | 实现侧边预览模式 |

---

## 2. 遗留事项与改进

### 2.1 ask:user 用户交互

**问题**：v0.1 仅定义 Schema，未实现真正的用户交互

**v0.2 实现**：

```typescript
interface AskUserAction extends BaseAction {
  type: 'ask:user';
  params: {
    question: string;           // 询问问题
    options?: string[];         // 选项列表（可选）
    defaultResponse?: string;  // 默认回答
  };
  constraints: {
    timeout: 300000;           // 等待5分钟
    retries: 0;
    requiresConfirm: true;
  };
}
```

**实现要点**：
1. PlanExecutor 暂停执行，发送 IPC 消息到 Renderer
2. Renderer 弹出确认对话框，显示问题 + 选项
3. 用户选择后，结果通过 IPC 返回给 PlanExecutor
4. PlanExecutor 继续执行，将用户回答作为结果

**IPC 通道**：
```
Renderer -> Main: 'ask:user:response' (用户回答)
Main -> Renderer: 'ask:user:request' (请求用户确认)
```

### 2.2 Replanner 动态重规划

**问题**：v0.1 缺少失败后的自动重规划能力

**v0.2 实现**：

```typescript
interface Replanner {
  /**
   * 根据失败原因重新规划
   */
  replan(request: ReplanRequest): Promise<ReplanResult>;
}

interface ReplanRequest {
  trigger: ReplanTrigger;
  failedNodeId?: string;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  executionState: ExecutionState;
  remainingPlan: Plan;
}

enum ReplanTrigger {
  ACTION_FAILED = 'action_failed',
  SELECTOR_INVALID = 'selector_invalid',
  NAVIGATION_ERROR = 'navigation_error',
  TIMEOUT = 'timeout',
  USER_REJECTED = 'user_rejected',
}
```

**重规划策略**：

| 触发条件 | 重试策略 |
|----------|----------|
| selector_invalid | 使用 LLM 重新生成选择器 |
| navigation_error | 尝试备用 URL 或搜索 |
| timeout | 增加等待时间或跳过该步骤 |
| user_rejected | 询问用户是否继续或取消 |

### 2.3 Selector 稳定性改进

**问题**：LLM 生成的 CSS 选择器经常无法匹配页面元素

**v0.2 改进**：

1. **多重策略选择器**：
```typescript
interface RobustSelector {
  primary: string;           // 主要选择器
  fallbacks?: string[];      // 备用选择器列表
  textMatch?: string;        // 文本匹配作为后备
  xpath?: string;           // XPath 作为最后后备
}
```

2. **选择器验证**：
   - 执行前先用 Playwright 验证选择器是否存在
   - 验证失败自动尝试 fallbacks

3. **LLM Prompt 改进**：
   - 提供页面 HTML 片段给 LLM
   - 要求 LLM 生成多个候选选择器
   - 添加选择器稳定性评分

4. **智能重试**：
   ```typescript
   const SELECTOR_RETRY_STRATEGY = {
     maxAttempts: 3,
     strategies: [
       'exact_selector',      // 精确匹配
       'partial_match',       // 部分匹配
       'text_contains',       // 文本包含
       'xpath_fallback',      // XPath 后备
     ],
   };
   ```

### 2.4 侧边预览模式

**问题**：v0.1 仅支持独立窗口预览

**v0.2 实现**：根据 PRD 3.6 节，实现侧边预览模式

```typescript
interface PreviewConfig {
  sidebar: {
    width: number;           // 侧边预览宽度，默认500px
  };
  collapsible: {
    collapsedHeight: number;      // 收起状态高度，默认40px
    expandedHeightRatio: number;  // 展开高度比例，默认0.6
  };
}

enum PreviewMode {
  SIDEBAR = 'sidebar',      // 侧边预览
  COLLAPSIBLE = 'collapsible', // 可折叠
  DETACHED = 'detached',    // 独立窗口
}
```

**实现要点**：
1. 使用 Electron BrowserView 嵌入主窗口
2. 与自动化浏览器共享 partition 实现画面同步
3. 可在三种模式间切换

---

## 3. 核心模块设计

### 3.1 Replanner 模块

```typescript
// src/core/planner/Replanner.ts
export class Replanner {
  private llmClient: LLMClient;
  private maxRetries: number = 3;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  async replan(request: ReplanRequest): Promise<ReplanResult> {
    const { trigger, error, executionState, remainingPlan } = request;

    switch (trigger) {
      case ReplanTrigger.SELECTOR_INVALID:
        return await this.handleSelectorFailure(error, executionState);
      case ReplanTrigger.NAVIGATION_ERROR:
        return await this.handleNavigationError(error, executionState);
      case ReplanTrigger.TIMEOUT:
        return await this.handleTimeout(error, executionState);
      case ReplanTrigger.USER_REJECTED:
        return this.handleUserRejected(remainingPlan);
      default:
        return { success: false, reason: 'unknown_trigger' };
    }
  }

  private async handleSelectorFailure(
    error: ReplanError,
    state: ExecutionState
  ): Promise<ReplanResult> {
    // 1. 获取当前页面的 HTML
    const html = await state.pageContent;
    
    // 2. 调用 LLM 生成新的选择器
    const response = await this.llmClient.generateSelector(html, error.message);
    
    // 3. 验证新选择器
    const isValid = await this.validateSelector(response.selector);
    if (!isValid) {
      return { success: false, reason: 'selector_regeneration_failed' };
    }

    // 4. 返回新计划
    return {
      success: true,
      modifiedNodes: [{
        nodeId: state.currentNodeId,
        newSelector: response.selector,
      }],
    };
  }

  private async handleNavigationError(
    error: ReplanError,
    state: ExecutionState
  ): Promise<ReplanResult> {
    // 1. 尝试搜索方式访问
    const searchUrl = await this.llmClient.generateSearchUrl(error.message);
    
    // 2. 或者使用备用 URL
    const fallbackUrls = state.availableUrls;
    
    return {
      success: true,
      suggestions: [searchUrl, ...fallbackUrls],
    };
  }

  private handleUserRejected(plan: Plan): ReplanResult {
    return {
      success: false,
      reason: 'user_rejected',
      suggestion: 'Ask user if they want to continue with modified plan',
    };
  }

  private async validateSelector(selector: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}
```

### 3.2 AskUserExecutor

```typescript
// src/core/executor/AskUserExecutor.ts
export class AskUserExecutor {
  private ipcRenderer: IpcRenderer;

  async execute(action: AskUserAction): Promise<ActionResult> {
    const startTime = Date.now();
    
    // 1. 发送请求到 Renderer
    const response = await this.ipcRenderer.invoke('ask:user:request', {
      question: action.params.question,
      options: action.params.options,
      timeout: action.constraints.timeout,
    });

    if (response.timeout) {
      return {
        success: false,
        error: {
          code: 'USER_TIMEOUT',
          message: 'User did not respond in time',
          recoverable: false,
        },
        duration: Date.now() - startTime,
      };
    }

    if (response.cancelled) {
      return {
        success: false,
        error: {
          code: 'USER_CANCELLED',
          message: 'User cancelled the request',
          recoverable: false,
        },
        duration: Date.now() - startTime,
      };
    }

    return {
      success: true,
      output: {
        answer: response.answer,
        selectedOption: response.selectedOption,
      },
      duration: Date.now() - startTime,
    };
  }
}
```

### 3.3 改进的 BrowserExecutor

```typescript
// src/core/executor/BrowserExecutor.ts (改进版)
export class BrowserExecutor {
  private browser: Browser;
  private llmClient: LLMClient;
  private retryCount: number = 0;

  async click(action: BrowserClickAction): Promise<ActionResult> {
    const startTime = Date.now();
    const { selector, index = 0, textMatch, fallbackSelectors } = action.params;

    // 策略1: 直接尝试选择器
    let element = await this.findElement(selector, index);
    if (element) {
      return await this.performClick(element, startTime);
    }

    // 策略2: 尝试备用选择器
    if (fallbackSelectors) {
      for (const fbSelector of fallbackSelectors) {
        element = await this.findElement(fbSelector, 0);
        if (element) {
          return await this.performClick(element, startTime);
        }
      }
    }

    // 策略3: 使用 textMatch
    if (textMatch) {
      element = await this.findByText(textMatch);
      if (element) {
        return await this.performClick(element, startTime);
      }
    }

    // 策略4: 获取页面 HTML，调用 LLM 重生成选择器
    if (this.retryCount < action.constraints.retries) {
      this.retryCount++;
      const newSelector = await this.regenerateSelector(selector);
      return await this.click({
        ...action,
        params: { ...action.params, selector: newSelector },
      });
    }

    // 全部失败
    return {
      success: false,
      error: {
        code: 'SELECTOR_NOT_FOUND',
        message: `Could not find element with selector: ${selector}`,
        recoverable: true,
      },
      duration: Date.now() - startTime,
    };
  }

  private async regenerateSelector(oldSelector: string): Promise<string> {
    const html = await this.page.content();
    const response = await this.llmClient.generateSelector(html, oldSelector);
    return response.selector;
  }

  private async performClick(element: Element, startTime: number): Promise<ActionResult> {
    try {
      await element.click();
      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CLICK_FAILED',
          message: error.message,
          recoverable: true,
        },
        duration: Date.now() - startTime,
      };
    }
  }
}
```

### 3.4 PreviewManager 侧边模式

```typescript
// src/preview/PreviewManager.ts
export class PreviewManager {
  private mainWindow: BrowserWindow;
  private previewView: BrowserView;
  private mode: PreviewMode = PreviewMode.DETACHED;

  async initialize(mainWindow: BrowserWindow): Promise<void> {
    this.mainWindow = mainWindow;
    
    this.previewView = new BrowserView({
      webPreferences: {
        partition: 'persist:automation',
      },
    });
  }

  setMode(mode: PreviewMode): void {
    this.mode = mode;
    
    switch (mode) {
      case PreviewMode.SIDEBAR:
        this.enableSidebarMode();
        break;
      case PreviewMode.COLLAPSIBLE:
        this.enableCollapsibleMode();
        break;
      case PreviewMode.DETACHED:
        this.enableDetachedMode();
        break;
    }
  }

  private enableSidebarMode(): void {
    this.detachedWindow?.close();
    this.detachedWindow = undefined;
    
    if (!this.mainWindow.getBrowserView()) {
      this.mainWindow.addBrowserView(this.previewView);
    }
    
    const bounds = this.mainWindow.getBounds();
    this.previewView.setBounds({
      x: bounds.width - 500,
      y: 0,
      width: 500,
      height: bounds.height,
    });
    
    this.previewView.setAutoResize({ width: true, height: true });
  }

  private enableCollapsibleMode(): void {
    const bounds = this.mainWindow.getBounds();
    this.previewView.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: 40,
    });
  }

  private enableDetachedMode(): void {
    this.mainWindow.removeBrowserView(this.previewView);
    
    this.detachedWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      title: 'OpenCowork - Browser Preview',
      webPreferences: {
        partition: 'persist:automation',
      },
    });
    
    this.detachedWindow.addBrowserView(this.previewView);
    this.previewView.setBounds({
      x: 0,
      y: 0,
      width: 1024,
      height: 768,
    });
  }
}
```

---

## 4. Action Schema 扩展

### 4.1 增强的 BrowserClickAction

```typescript
interface BrowserClickAction extends BaseAction {
  type: 'browser:click';
  params: {
    selector: string;
    index?: number;
    textMatch?: string;            // 新增: 文本匹配后备
    fallbackSelectors?: string[]; // 新增: 备用选择器列表
  };
  constraints: {
    timeout: 10000;
    retries: 3;                    // 增加重试次数
    requiresConfirm: false;
  };
}
```

### 4.2 ask:user 结果处理

```typescript
interface AskUserResult {
  success: boolean;
  output?: {
    answer: string;
    selectedOption?: string;
  };
  error?: {
    code: 'USER_TIMEOUT' | 'USER_CANCELLED';
    message: string;
    recoverable: boolean;
  };
  duration: number;
}
```

---

## 5. UI 组件规格

### 5.1 确认对话框组件

```typescript
// src/renderer/components/AskUserDialog.tsx
interface AskUserDialogProps {
  question: string;
  options?: string[];
  onAnswer: (answer: string) => void;
  onCancel: () => void;
  timeout: number;
}
```

**样式规格**：
- 居中弹窗，宽度 400px
- 背景: var(--color-surface)
- 圆角: var(--radius-lg)
- 问题文字: 16px, 600 字重
- 选项按钮: 列表形式，每行一个
- 倒计时显示: 剩余时间

### 5.2 PlanViewer 增强

**改进点**：
- 显示失败节点及错误信息
- 显示重规划后的新路径
- 高亮当前重试次数

```typescript
// PlanViewer 状态
interface PlanViewerState {
  currentNode: string;
  failedNodes: {
    nodeId: string;
    error: string;
    retryCount: number;
  }[];
  replanSuggestions: string[];
}
```

### 5.3 预览模式切换器

```typescript
// 预览控制栏
interface PreviewControlBarProps {
  currentMode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
}

// 样式
const controlBarStyle = `
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
`;
```

---

## 6. 里程碑

### Week 1: Replanner 核心

| 任务 | 交付 |
|------|------|
| Replanner 模块实现 | ✅ |
| 选择器验证逻辑 | ✅ |
| 失败类型定义 | ✅ |
| 与 PlanExecutor 集成 | ✅ |

### Week 2: ask:user 实现

| 任务 | 交付 |
|------|------|
| AskUserDialog 组件 | ✅ |
| IPC 通道实现 | ✅ |
| PlanExecutor 暂停/恢复 | ✅ |
| 与 LLM 集成 | ✅ |

### Week 3: Selector 改进 + 侧边预览

| 任务 | 交付 |
|------|------|
| 多策略选择器 | ✅ |
| LLM 选择器重生成 | ✅ |
| 智能重试策略 | ✅ |
| 侧边预览模式 | ✅ |
| 预览模式切换器 | ✅ |

### Week 4: 集成 + 收尾

| 任务 | 交付 |
|------|------|
| 端到端流程测试 | ✅ |
| Bug 修复 | ✅ |
| 性能优化 | ✅ |
| v0.2 交付 | ✅ |

---

## 附录

### A. v0.2 vs v0.1 对比

| 功能 | v0.1 | v0.2 |
|------|------|------|
| ask:user | 仅 Schema | 完整实现 |
| Replanner | 未实现 | 实现 |
| Selector 稳定性 | 基础 | 多策略+重试 |
| 侧边预览 | 未实现 | 实现 |
| 可折叠预览 | 未实现 | 实现 |
| 预览模式切换 | 仅独立窗口 | 三模式切换 |

### B. 依赖更新

```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "playwright": "^1.40.0"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "@testing-library/react": "^14.1.0"
  }
}
```

### C. 文件结构变更

```
src/
├── core/
│   ├── planner/
│   │   ├── Replanner.ts      # 新增
│   │   └── ...
│   ├── executor/
│   │   ├── AskUserExecutor.ts # 新增
│   │   └── BrowserExecutor.ts # 增强
│   └── ...
├── preview/
│   ├── PreviewManager.ts     # 增强
│   └── ...
└── renderer/
    ├── components/
    │   ├── AskUserDialog.tsx # 新增
    │   └── ...
    └── ...
```

---

*文档版本: v0.2 草稿*
*创建日期: 2026-03-28*