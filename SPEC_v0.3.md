# OpenCowork v0.3 技术规格说明书

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.3       |
| 更新日期 | 2026-03-29 |
| 状态     | 正式版     |
| 基于PRD  | v2.4       |
| 前置版本 | v0.2       |

---

## 目录

1. [版本目标](#1-版本目标)
2. [反爬虫机制](#2-反爬虫机制)
3. [工业级Browser Agent架构](#3-工业级browser-agent架构)
4. [核心模块设计](#4-核心模块设计)
5. [文件结构](#5-文件结构)
6. [里程碑](#6-里程碑)

---

## 1. 版本目标

**目标**：实现工业级Browser Agent架构，提升任务成功率达到85-95%

| 目标         | 说明                                           |
| ------------ | ---------------------------------------------- |
| UI语义层     | 实现UIGraph，将DOM转换为语义化元素图谱         |
| 验证层       | 实现Verifier，每步执行后验证页面状态变化       |
| 独立恢复引擎 | 实现RecoveryEngine，与Replanner协同处理失败    |
| 短期记忆     | 实现ShortTermMemory，记录成功/失败轨迹用于学习 |
| 反爬虫增强   | 记录现有反爬虫机制，为未来增强预留接口         |

### 成功指标

| 指标         | v0.2 | v0.3目标 |
| ------------ | ---- | -------- |
| 任务成功率   | ~65% | 85-95%   |
| 点击准确率   | ~80% | >95%     |
| 单步延迟     | 2-5s | 1-3s     |
| 失败后恢复率 | ~50% | >80%     |

---

## 2. 反爬虫机制

### 2.1 当前实现

位置：`src/core/executor/BrowserExecutor.ts` 第94-151行 `ensureBrowser()` 方法

#### 2.1.1 Chromium启动参数

```typescript
this.browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled", // 移除自动化特征标记
  ],
});
```

#### 2.1.2 UserAgent伪装

```typescript
this.context = await this.browser.newContext({
  viewport: { width: 1280, height: 720 },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
});
```

#### 2.1.3 JavaScript注入（addInitScript）

```typescript
await this.page.addInitScript(() => {
  // 1. 移除 webdriver 标记
  Object.defineProperty(navigator, "webdriver", {
    get: () => undefined,
  });

  // 2. 伪造 permissions.query
  if (window.navigator.permissions) {
    window.navigator.permissions.query = (parameters: any) => {
      if (parameters.name === "notifications") {
        return Promise.resolve({ state: "default" });
      }
      return Promise.resolve({ state: "prompt" });
    };
  }

  // 3. 伪造 plugins 数组
  Object.defineProperty(navigator, "plugins", {
    get: () => [1, 2, 3, 4, 5],
  });

  // 4. 伪造 languages
  Object.defineProperty(navigator, "languages", {
    get: () => ["zh-CN", "zh", "en"],
  });
});
```

### 2.2 防检测原理

| 检测点                                          | 原始值（Playwright） | 伪装后                  | 防检测原理                             |
| ----------------------------------------------- | -------------------- | ----------------------- | -------------------------------------- |
| `navigator.webdriver`                           | `true`               | `undefined`             | 网站通过检测此属性判断是否自动化       |
| `navigator.permissions.query`                   | 返回 `denied`        | 返回 `default`/`prompt` | 真实浏览器权限通常是允许状态           |
| `navigator.plugins`                             | `[]` 或空            | `[1,2,3,4,5]`           | 真实Chrome有插件列表，空数组暴露自动化 |
| `navigator.languages`                           | 可能不正确           | `['zh-CN','zh','en']`   | 与UserAgent匹配                        |
| `--disable-blink-features=AutomationControlled` | Flag存在             | Flag删除                | 移除Chromium自动化标识                 |

### 2.3 已知弱点（v0.3暂不修复）

#### 弱点1：`navigator.permissions.query`伪造不完整

**问题**：当前只特殊处理了`notifications`权限，其他权限（如`clipboard-read`、`clipboard-write`等）仍可能返回`denied`，被网站检测。

**当前实现**：

```typescript
window.navigator.permissions.query = (parameters: any) => {
  if (parameters.name === "notifications") {
    return Promise.resolve({ state: "default" });
  }
  return Promise.resolve({ state: "prompt" }); // 其他权限统一返回prompt
};
```

**潜在风险**：部分网站会检查`clipboard`等敏感权限，统一的`prompt`可能不符合预期行为。

#### 弱点2：缺少`chrome.runtime`对象

**问题**：真实Chrome扩展有`window.chrome.runtime`对象，自动化浏览器没有这个对象，被检测后会暴露自动化环境。

**真实Chrome**：

```javascript
window.chrome.runtime.id; // 扩展ID
window.chrome.runtime.getURL(); // 获取扩展内资源URL
```

**自动化浏览器**：

```javascript
window.chrome; // undefined
```

**潜在风险**：部分网站通过检测`window.chrome`是否存在来判断是否自动化。

### 2.4 反爬虫增强建议（未来版本）

```typescript
// 未来增强方向1：完善permissions.query伪造
window.navigator.permissions.query = (parameters: any) => {
  const permissionMap = {
    notifications: "default",
    "clipboard-read": "prompt",
    "clipboard-write": "granted",
    geolocation: "prompt",
    camera: "denied",
    microphone: "denied",
  };
  return Promise.resolve({
    state: permissionMap[parameters.name] || "prompt",
  });
};

// 未来增强方向2：添加chrome.runtime伪造
Object.defineProperty(window, "chrome", {
  get: () => ({
    runtime: {
      id: "fake_extension_id_" + Math.random().toString(36).substr(2, 9),
      getURL: (path: string) => "chrome-extension://fake_extension_id/" + path,
    },
  }),
});
```

---

## 3. 工业级Browser Agent架构

### 3.1 整体架构

```
User Task
    ↓
Task Planner（高层规划）
    ↓
Step Controller（执行循环）
    ↓
┌─────────────────────────────────────────────┐
│              Agent Loop (核心)               │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐  │
│  │Observer │ → │ Policy  │ → │ Executor│  │
│  │ (观察)  │   │ (决策)  │   │ (执行)  │  │
│  └────┬────┘   └────┬────┘   └────┬────┘  │
│       │             │             │         │
│       ↓             ↓             ↓         │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐  │
│  │ UIGraph │   │  Action │   │Verifier │  │
│  │(语义图) │   │(动作约束)│   │ (验证)  │  │
│  └─────────┘   └─────────┘   └────┬────┘  │
│                                   │         │
│                                   ↓         │
│                          ┌────────────────┐ │
│                          │ RecoveryEngine │ │
│                          │  (恢复引擎)    │ │
│                          └────────────────┘ │
│                                   │         │
│                                   ↓         │
│                          ┌────────────────┐ │
│                          │ShortTermMemory │ │
│                          │  (短期记忆)    │ │
│                          └────────────────┘ │
└─────────────────────────────────────────────┘
    ↓
Web Page
```

### 3.2 核心原则

**原则1：LLM只做决策，不直接操控浏览器**

```
❌ LLM输出: await page.click("#login-btn")
✅ LLM输出: { action: "click", target: "btn_login" }
   真实selector在executor层映射
```

**原则2：DOM转换为语义图，不要直接给LLM原始HTML**

```
❌ LLM看到: <button class="btn btn-primary...">Login</button>
✅ LLM看到: { id: "btn_login", role: "button", label: "Login", selector: "#login-btn" }
```

**原则3：严格的Observe → Decide → Act → Verify循环**

```
每一步都会:
1. Observer.capture() - 获取当前UIGraph
2. Policy.decide() - LLM决定下一步action
3. Executor.run() - 执行action
4. Verifier.verify() - 验证执行结果
5. [如果失败] RecoveryEngine.decide() - 决定恢复策略
```

**原则4：限制LLM可执行动作集合**

```
只允许:
- goto(url)
- click(selector)
- type(selector, text)
- select(selector, value)
- wait(selector)
- extract(selector)

不允许:
- 自由鼠标操作
- 执行任意JavaScript
```

### 3.3 模块职责

| 模块                | 职责                | 输入                | 输出               |
| ------------------- | ------------------- | ------------------- | ------------------ |
| **Observer**        | 捕获页面语义图      | Page对象            | UIGraph            |
| **UIGraph**         | 将DOM转换为语义元素 | Page对象            | 语义化元素列表     |
| **Verifier**        | 验证action执行结果  | Action + Result     | VerificationResult |
| **RecoveryEngine**  | LLM决策恢复策略     | RecoveryContext     | RecoveryAction     |
| **ShortTermMemory** | 记录执行轨迹        | Action/Result/Error | 记忆查询结果       |

### 3.4 与现有v0.2架构的集成

```
v0.2 架构                    v0.3 新增模块
─────────────────────────────────────────────────
TaskEngine              →    TaskEngine (集成新模块)
    │
    ├── PlanExecutor        PlanExecutor (保持)
    │
    ├── Replanner      →    Replanner (保留，与RecoveryEngine协同)
    │                         ↑
    │                    RecoveryEngine (新增)
    │
    ├── BrowserExecutor →    BrowserExecutor (保持，反爬虫代码不动)
    │
    ├── [新增]              Observer
    ├── [新增]              UIGraph
    ├── [新增]              Verifier
    └── [新增]              ShortTermMemory
```

---

## 4. 核心模块设计

### 4.1 UIGraph - 语义图构建器

#### 4.1.1 核心类型

```typescript
// src/types/uiElement.ts

export enum ElementVisibility {
  VISIBLE = "visible",
  HIDDEN = "hidden",
  DETACHED = "detached",
}

export enum ElementRole {
  BUTTON = "button",
  INPUT = "input",
  LINK = "link",
  SELECT = "select",
  TEXTAREA = "textarea",
  CHECKBOX = "checkbox",
  RADIO = "radio",
  UNKNOWN = "unknown",
}

export interface UIElement {
  id: string; // 语义ID (如 "btn_login")
  role: ElementRole; // 元素角色
  label: string; // 显示文本/aria-label
  selector: string; // 稳定CSS选择器
  selectorPriority: number; // 选择器优先级 (1-6)
  boundingBox: {
    // 位置信息
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visibility: ElementVisibility;
  disabled: boolean;
  parentContext: string; // 父容器上下文
  attributes: Record<string, string>;
}

export interface UIGraph {
  url: string;
  title: string;
  timestamp: number;
  elements: UIElement[];
  navigation: UIElement[]; // 导航类元素
  inputs: UIElement[]; // 输入类元素
  actions: UIElement[]; // 按钮/可点击元素
  content: UIElement[]; // 内容类链接
}
```

#### 4.1.2 Selector优先级fallback链（灵活设计）

```typescript
const SELECTOR_PRIORITY_CHAIN = [
  "data-testid", // 优先级1: 测试ID（最稳定）
  "id", // 优先级2: ID（需唯一性检查）
  "aria-label", // 优先级3: 无障碍标签
  "name", // 优先级4: name属性
  "role+text", // 优先级5: role+文本组合
  "css-path", // 优先级6: 相对CSS路径（最后方案）
] as const;

function buildSelector(
  el: Element,
): { selector: string; priority: number } | null {
  // 1. data-testid
  if (el.dataset.testid) {
    return { selector: `[data-testid="${el.dataset.testid}"]`, priority: 1 };
  }

  // 2. id (需要唯一性检查)
  if (el.id && document.querySelectorAll(`#${el.id}`).length === 1) {
    return { selector: `#${el.id}`, priority: 2 };
  }

  // 3. aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim().length > 0) {
    const role = el.getAttribute("role") || el.tagName.toLowerCase();
    return {
      selector: `[role="${role}"][aria-label="${ariaLabel}"]`,
      priority: 3,
    };
  }

  // 4. name属性
  const name = el.getAttribute("name");
  if (name) {
    return { selector: `[name="${name}"]`, priority: 4 };
  }

  // 5. role + text
  const role = el.getAttribute("role");
  const text = el.innerText?.trim();
  if (role && text) {
    return { selector: `[role="${role}"]`, priority: 5 };
  }

  // 6. CSS path (最后方案)
  return { selector: generateRelCSSPath(el), priority: 6 };
}
```

#### 4.1.3 UIGraph构建流程

```typescript
// src/browser/uiGraph.ts

export async function buildUIGraph(
  page: Page,
  config?: Partial<ObserverConfig>,
): Promise<UIGraph> {
  // 1. 获取 accessibility snapshot（优先，获取语义信息）
  const a11ySnapshot = await page.accessibility.snapshot().catch(() => null);

  // 2. 获取 DOM 元素列表
  const domElements = await page.evaluate((cfg) => {
    const candidates = document.querySelectorAll(
      'button, a, input, select, textarea, [role="button"], [role="link"]',
    );
    // ... 收集元素信息
    return results;
  }, config);

  // 3. 构建语义元素
  const elements = domElements.map((el) => buildUIElement(el, config));

  // 4. 分类元素
  return categorizeElements(page.url(), elements);
}
```

#### 4.1.4 元素ID生成策略

```typescript
function generateElementId(dom: DOMElement): string {
  const { attributes, tag, text, index } = dom;

  // 优先级: data-testid > id > text > index
  if (attributes["data-testid"]) return attributes["data-testid"];
  if (attributes["id"]) return attributes["id"];

  const label = text || dom.value || "";
  const cleanLabel = label
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "")
    .slice(0, 20)
    .toLowerCase();

  if (cleanLabel) {
    return `${tag}_${cleanLabel}`;
  }

  return `${tag}_${index}`;
}
```

### 4.2 Observer - 页面观察者

#### 4.2.1 核心功能

```typescript
// src/browser/observer.ts

export class Observer {
  private page: Page;
  private lastGraph: UIGraph | null = null;
  private config: ObserverConfig;

  constructor(page: Page, config?: Partial<ObserverConfig>) {
    this.page = page;
    this.config = { ...DEFAULT_OBSERVER_CONFIG, ...config };
  }

  // 捕获当前页面UIGraph
  async capture(): Promise<UIGraph> {
    const url = this.page.url();
    const title = await this.page.title().catch(() => "");

    const graph = await buildUIGraph(this.page, this.config);
    graph.url = url;
    graph.title = title;

    this.lastGraph = graph;
    return graph;
  }

  // 捕获与上次的差异
  async captureDiff(): Promise<{
    added: UIElement[];
    removed: UIElement[];
    changed: UIElement[];
  }> {
    const current = await this.capture();
    const previous = this.lastGraph;

    if (!previous) {
      return { added: current.elements, removed: [], changed: [] };
    }

    // 计算差异...
    return { added, removed, changed };
  }

  getLastGraph(): UIGraph | null {
    return this.lastGraph;
  }
}
```

#### 4.2.2 调用时机

```
触发场景:
1. [失败后] TaskEngine处理node_error时调用 observer.capture()
2. [可选] 每个action执行前调用 observer.captureDiff()

不主动调用原因: 减少不必要的页面DOM遍历，提升性能
```

### 4.3 Verifier - 验证层

#### 4.3.1 验证类型

```typescript
// src/types/verifier.ts

export enum VerificationType {
  URL_CHANGE = "url_change", // URL发生变化
  URL_MATCH = "url_match", // URL匹配预期
  ELEMENT_VISIBLE = "element_visible", // 元素可见
  ELEMENT_HIDDEN = "element_hidden", // 元素隐藏
  ELEMENT_CONTAINS = "element_contains", // 元素包含文本
  NETWORK_IDLE = "network_idle", // 网络空闲
  DOM_STABLE = "dom_stable", // DOM稳定
}

export interface VerificationResult {
  verified: boolean;
  type: VerificationType;
  expected?: string;
  actual?: string;
  message?: string;
}
```

#### 4.3.2 验证器实现

```typescript
// src/executor/verifier.ts

export class Verifier {
  private page: Page;
  private previousUrl: string = "";

  constructor(page: Page) {
    this.page = page;
  }

  async verify(
    action: AnyAction,
    result: ActionResult,
  ): Promise<VerificationResult> {
    this.previousUrl = this.page.url();

    switch (action.type) {
      case "browser:navigate":
        return this.verifyNavigate(action);
      case "browser:click":
        return this.verifyClick(action, result);
      case "browser:input":
        return this.verifyInput(action, result);
      case "browser:wait":
        return this.verifyWait(action);
      default:
        return { verified: result.success, type: VerificationType.DOM_STABLE };
    }
  }

  private async verifyClick(
    action: BrowserClickAction,
    result: ActionResult,
  ): Promise<VerificationResult> {
    if (!result.success) {
      return {
        verified: false,
        type: VerificationType.ELEMENT_VISIBLE,
        message: "Click failed",
      };
    }

    const currentUrl = this.page.url();
    const urlChanged = currentUrl !== this.previousUrl;

    // URL变化说明点击可能导致了导航
    if (urlChanged) {
      return {
        verified: true,
        type: VerificationType.URL_CHANGE,
        actual: currentUrl,
      };
    }

    // DOM稳定验证
    const stable = await this.waitForDOMStable(1500);
    return {
      verified: stable,
      type: VerificationType.DOM_STABLE,
      message: stable
        ? "DOM stable after click"
        : "DOM still changing after click",
    };
  }

  private async waitForDOMStable(timeout: number = 1500): Promise<boolean> {
    const start = Date.now();
    let previousLength = 0;
    let stableCount = 0;

    while (Date.now() - start < timeout) {
      const currentLength = await this.page.evaluate(
        () => document.body.children.length,
      );

      if (currentLength === previousLength) {
        stableCount++;
        if (stableCount >= 2) return true;
      } else {
        stableCount = 0;
      }

      previousLength = currentLength;
      await this.page.waitForTimeout(200);
    }

    return stableCount >= 2;
  }
}
```

### 4.4 RecoveryEngine - 恢复引擎

#### 4.4.1 恢复策略

```typescript
// src/recovery/recoveryEngine.ts

export enum RecoveryStrategy {
  RETRY_SAME = "retry_same", // 重试相同action
  RETRY_WITH_WAIT = "retry_with_wait", // 等待后重试
  USE_FALLBACK_SELECTOR = "use_fallback_selector", // 使用备用selector
  REGENERATE_SELECTOR = "regenerate_selector", // LLM重新生成selector
  SIMPLIFY_ACTION = "simplify_action", // 简化action
  SKIP_STEP = "skip_step", // 跳过该步骤
  RELOAD_PAGE = "reload_page", // 重新加载页面
  ASK_USER = "ask_user", // 询问用户
  GIVE_UP = "give_up", // 放弃
}

export interface RecoveryContext {
  failedAction: AnyAction;
  failedNodeId: string;
  actionResult: ActionResult;
  currentGraph: UIGraph;
  previousGraph: UIGraph | null;
  retryCount: number;
  maxRetries: number;
}

export interface RecoveryAction {
  strategy: RecoveryStrategy;
  newAction?: AnyAction;
  newSelector?: string;
  waitMs?: number;
  reason: string;
}
```

#### 4.4.2 策略决策

```typescript
export class RecoveryEngine {
  private page: Page;
  private llmClient = getLLMClient();

  async decide(context: RecoveryContext): Promise<RecoveryAction> {
    const { actionResult, retryCount, maxRetries } = context;

    // 超过最大重试次数
    if (retryCount >= maxRetries) {
      return this.giveUp("Max retries exceeded");
    }

    // 不可恢复错误
    if (!actionResult.error?.recoverable) {
      return this.giveUp("Unrecoverable error");
    }

    const errorCode = actionResult.error?.code || "";

    switch (errorCode) {
      case "SELECTOR_NOT_FOUND":
      case "SELECTOR_ERROR":
        return this.handleSelectorError(context);

      case "NAVIGATION_ERROR":
        return this.handleNavigationError(context);

      case "WAIT_TIMEOUT":
        return this.handleTimeoutError(context);

      case "CLICK_FAILED":
      case "CLICK_ERROR":
        return this.handleClickError(context);

      default:
        return this.handleGenericError(context);
    }
  }

  private handleSelectorError(context: RecoveryContext): RecoveryAction {
    const { failedAction, currentGraph, retryCount } = context;

    // 策略1: 在UIGraph中找同类型元素作为fallback
    const elementType = this.getActionTargetType(failedAction);
    const alternatives = currentGraph.elements.filter(
      (e) => e.role === elementType,
    );

    if (alternatives.length > 0 && retryCount === 0) {
      const alt = alternatives[0];
      return {
        strategy: RecoveryStrategy.USE_FALLBACK_SELECTOR,
        newSelector: alt.selector,
        reason: `Using alternative ${elementType}: ${alt.id}`,
      };
    }

    // 策略2: LLM重新生成selector
    if (retryCount < 2) {
      return {
        strategy: RecoveryStrategy.REGENERATE_SELECTOR,
        reason: "Regenerating selector via LLM",
      };
    }

    // 策略3: 简化action
    if (
      failedAction.type === "browser:click" ||
      failedAction.type === "browser:input"
    ) {
      return {
        strategy: RecoveryStrategy.SIMPLIFY_ACTION,
        reason: "Simplifying action to avoid selector dependency",
      };
    }

    return this.giveUp("Selector recovery exhausted");
  }

  // LLM选择器再生成
  async regenerateSelector(context: RecoveryContext): Promise<string | null> {
    const { failedAction, currentGraph } = context;

    const htmlSnippet = await this.getPageSnippet();

    const systemPrompt = `You are a CSS selector generation expert. Given the page UI graph and the failed action, generate a precise CSS selector.`;

    const userPrompt = `Page UIGraph:
${JSON.stringify(currentGraph.elements.slice(0, 30), null, 2)}

Failed action:
${JSON.stringify(failedAction, null, 2)}

Generate a precise CSS selector. Output ONLY the selector.`;

    try {
      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      const response = await this.llmClient.chat(messages);
      return this.extractSelector(response.content);
    } catch (error) {
      console.error("[RecoveryEngine] Selector regeneration failed:", error);
      return null;
    }
  }

  private async getPageSnippet(): Promise<string> {
    try {
      const html = await this.page.content();
      return html.substring(0, 10000);
    } catch {
      return "";
    }
  }

  private extractSelector(content: string): string | null {
    const match = content.trim().match(/["']([#.\[][^\s"'#.\[\]]+)["']/);
    return match ? match[1] : null;
  }
}
```

### 4.5 ShortTermMemory - 短期记忆

#### 4.5.1 记忆类型

```typescript
// src/memory/shortTermMemory.ts

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: "action" | "navigation" | "extraction" | "error" | "recovery";
  action?: AnyAction;
  result?: ActionResult;
  pageUrl?: string;
  pageTitle?: string;
  uiGraph?: UIGraph;
  error?: {
    code: string;
    message: string;
    recoveryStrategy?: RecoveryStrategy;
  };
  nodeId?: string;
  nodeDescription?: string;
}

export interface TrajectorySegment {
  id: string;
  task: string;
  entries: MemoryEntry[];
  startTime: number;
  endTime?: number;
  success?: boolean;
}
```

#### 4.5.2 记忆功能

```typescript
export class ShortTermMemory {
  private entries: MemoryEntry[] = [];
  private trajectories: TrajectorySegment[] = [];
  private currentTrajectory: TrajectorySegment | null = null;
  private maxEntries: number = 200;

  // 开启新的轨迹
  startTrajectory(task: string): string { ... }

  // 记录动作
  recordAction(action: AnyAction, result: ActionResult, pageUrl?: string, nodeId?: string): void {
    this.addEntry({
      type: result.success ? 'action' : 'error',
      action,
      result,
      pageUrl,
      nodeId,
    });
  }

  // 记录错误
  recordError(error: { code: string; message: string }, context: {
    action?: AnyAction;
    pageUrl?: string;
    nodeId?: string;
    recoveryStrategy?: RecoveryStrategy;
  }): void { ... }

  // 查询相似动作（用于学习）
  findSimilarAction(targetAction: Partial<AnyAction>, maxResults: number = 3): {
    entry: MemoryEntry;
    similarity: number;
  }[] { ... }

  // 获取最近错误
  getRecentErrors(count: number = 5): MemoryEntry[] { ... }

  // 获取失败的选择器列表
  getFailedSelectors(): string[] { ... }
}
```

---

## 5. 文件结构

### 5.1 新增文件

```
src/
├── types/
│   ├── uiElement.ts              # 新增: UI元素和UIGraph类型定义
│   └── verifier.ts               # 新增: Verifier类型定义
├── browser/
│   ├── uiGraph.ts                # 新增: UIGraph语义图构建器
│   └── observer.ts               # 新增: 页面观察者类
├── executor/
│   └── verifier.ts               # 新增: 验证层
├── recovery/
│   └── recoveryEngine.ts         # 新增: 独立恢复引擎
├── memory/
│   └── shortTermMemory.ts        # 新增: 短期记忆
└── core/
    └── runtime/
        └── TaskEngine.ts         # 修改: 集成四个新模块
```

### 5.2 文件说明

| 文件                         | 行数(估) | 用途                                     |
| ---------------------------- | -------- | ---------------------------------------- |
| `types/uiElement.ts`         | ~80      | UI元素类型、UIGraph类型、ObserverConfig  |
| `types/verifier.ts`          | ~30      | VerificationType枚举、VerificationResult |
| `browser/uiGraph.ts`         | ~200     | UIGraph构建器、selector生成、元素分类    |
| `browser/observer.ts`        | ~80      | Observer类、capture/captureDiff方法      |
| `executor/verifier.ts`       | ~180     | Verifier类、各种验证方法                 |
| `recovery/recoveryEngine.ts` | ~250     | RecoveryEngine类、策略决策、LLM集成      |
| `memory/shortTermMemory.ts`  | ~200     | ShortTermMemory类、轨迹记录、查询        |
| `TaskEngine.ts`              | +100     | 集成新模块的逻辑                         |

### 5.3 与现有文件的关系

```
新增模块对现有代码的影响:

BrowserExecutor (保持不动)
    │
    ├── 反爬虫代码 (117-139行 addInitScript) ← 完全不动
    ├── getPage() 方法                      ← Observer/Verifier通过此获取Page
    └── page对象                           ← 传递给新模块

Replanner (保持)
    │
    └── 与RecoveryEngine协同
        - Replanner处理复杂重规划
        - RecoveryEngine处理快速恢复
        - 二者在TaskEngine中根据场景选择使用

TaskPlanner (保持)
    │
    └── 输出Plan给PlanExecutor执行
```

---

## 6. 里程碑

### Week 1-2: 基础层实现

| 任务                | 交付             | 依赖    |
| ------------------- | ---------------- | ------- |
| types/uiElement.ts  | UI元素类型定义   | -       |
| types/verifier.ts   | Verifier类型定义 | -       |
| browser/uiGraph.ts  | UIGraph构建器    | types   |
| browser/observer.ts | Observer类       | uiGraph |

### Week 2-3: 验证层和恢复层

| 任务                       | 交付                     | 依赖          |
| -------------------------- | ------------------------ | ------------- |
| executor/verifier.ts       | Verifier验证器           | Observer      |
| recovery/recoveryEngine.ts | RecoveryEngine恢复引擎   | Verifier, LLM |
| 集成到TaskEngine           | 在node_error中调用新模块 | 以上全部      |

### Week 4-5: 记忆层和调优

| 任务                      | 交付                 | 依赖     |
| ------------------------- | -------------------- | -------- |
| memory/shortTermMemory.ts | 短期记忆             | -        |
| 完整集成测试              | 端到端测试           | 以上全部 |
| 性能调优                  | 减少不必要的页面捕获 | -        |

### Week 5-6: 验收和文档

| 任务         | 交付               | 依赖     |
| ------------ | ------------------ | -------- |
| 成功率测试   | 达到85-95%成功率   | Week 4   |
| 反爬虫测试   | 验证现有机制完整性 | -        |
| v0.3文档更新 | 完整文档           | 以上全部 |
| v0.3发布     | 合并到main         | 通过测试 |

---

## 附录

### A. v0.3 vs v0.2 对比

| 功能            | v0.2        | v0.3                    |
| --------------- | ----------- | ----------------------- |
| UIGraph语义层   | ❌ 无       | ✅ 实现                 |
| Observer观察者  | ❌ 无       | ✅ 实现                 |
| Verifier验证层  | ❌ 无       | ✅ 实现                 |
| RecoveryEngine  | ❌ 无       | ✅ 实现                 |
| ShortTermMemory | ❌ 无       | ✅ 实现                 |
| Replanner       | ✅ 基础实现 | ✅ 与RecoveryEngine协同 |
| 反爬虫          | ✅ 基础实现 | ✅ 记录完整（暂不增强） |
| 预期成功率      | 60-70%      | 85-95%                  |

### B. 成功指标

| 指标              | v0.2 | v0.3目标 |
| ----------------- | ---- | -------- |
| Task success rate | ~65% | 85-95%   |
| Click accuracy    | ~80% | >95%     |
| Step latency      | 2-5s | 1-3s     |
| 失败后恢复率      | ~50% | >80%     |

### C. 设计原则总结

1. **LLM只做决策**：不输出selector，只输出action target
2. **DOM转语义图**：UIGraph替代原始HTML给LLM
3. **验证驱动**：每步执行后必须验证
4. **失败后观察**：Observer在失败后才调用，减少开销
5. **LLM恢复决策**：RecoveryEngine用LLM做策略选择
6. **记忆学习**：ShortTermMemory记录成功/失败轨迹
7. **反爬虫不动**：BrowserExecutor的addInitScript完全保留

---

_文档版本: v0.3 草稿_
_创建日期: 2026-03-29_
