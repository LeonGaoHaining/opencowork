# OpenCowork v0.4 技术规格说明书

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.4       |
| 更新日期 | 2026-03-29 |
| 状态     | 规划中     |
| 基于PRD  | v2.5       |
| 前置版本 | v0.3       |

---

## 目录

1. [版本目标](#1-版本目标)
2. [技术架构](#2-技术架构)
3. [核心模块设计](#3-核心模块设计)
4. [文件结构](#4-文件结构)
5. [实施计划](#5-实施计划)
6. [成功指标](#6-成功指标)

---

## 1. 版本目标

**目标**: 全量采用 LangChain/LangGraph TypeScript 版本替换现有架构，实现标准化 Agent 执行流程

### 核心目标

| 目标       | 说明                                       |
| ---------- | ------------------------------------------ |
| **标准化** | 使用 LangGraph StateGraph 作为核心执行框架 |
| **持久化** | 内置 Durable Execution，任务可恢复         |
| **记忆化** | Memory Store 替代 ShortTermMemory          |
| **可观测** | LangSmith 集成，运行时追踪                 |

### 版本变更说明

| 原版本         | 新版本        | 说明           |
| -------------- | ------------- | -------------- |
| v0.4 功能完备  | v0.5 功能完备 | 顺延至下一版本 |
| v0.5 Skill系统 | v0.6 定时任务 | 顺延           |
| v0.6 多端协同  | v0.7 多端协同 | 顺延           |
| v0.7 正式版    | v1.0 正式版   | 顺延           |

---

## 2. 技术架构

### 2.1 架构对比

| 模块         | v0.3 实现                 | v0.4 LangGraph 实现        |
| ------------ | ------------------------- | -------------------------- |
| **状态管理** | `Map<string, TaskHandle>` | StateSchema + Checkpointer |
| **任务执行** | PlanExecutor 线性执行     | StateGraph Nodes/Edges     |
| **规划器**   | TaskPlanner LLM 调用      | Agent Node + Tools         |
| **恢复机制** | RecoveryEngine 手动       | 内置 Durable Execution     |
| **记忆**     | ShortTermMemory 内存Map   | Memory Store               |
| **验证**     | Verifier 手动             | Graph State Validation     |
| **可观测**   | console.log 手动          | LangSmith 集成             |

### 2.2 LangGraph 架构图

```
User Task
    ↓
┌─────────────────────────────────────────────┐
│           LangGraph Agent                   │
│  ┌─────────────┐   ┌─────────────┐          │
│  │   Planner   │ → │  Executor   │          │
│  │   Node      │   │   Node      │          │
│  └──────┬──────┘   └──────┬──────┘          │
│         │                 │                 │
│         ↓                 ↓                 │
│  ┌─────────────┐   ┌─────────────┐          │
│  │   Verifier  │ → │   Memory    │          │
│  │   Node      │   │   Node      │          │
│  └─────────────┘   └─────────────┘          │
└─────────────────────────────────────────────┘
         ↓                 ↓
┌─────────────────────────────────────────────┐
│           LangGraph Runtime                  │
│  - StateSchema (状态定义)                    │
│  - Checkpointer (持久化)                    │
│  - Memory Store (记忆)                      │
│  - Tools (browser/cli/vision)               │
└─────────────────────────────────────────────┘
    ↓
Web Page / CLI / Vision
```

### 2.3 核心原则

**原则1: 使用 LangGraph 作为执行框架**

- 不再自定义状态机和执行循环
- 使用 StateGraph 定义节点和边
- 内置 checkpoint 持久化

**原则2: Tool 封装现有执行器**

- BrowserExecutor → browserTool
- CLIExecutor → cliTool
- VisionExecutor → visionTool

**原则3: Agent 负责决策**

- 使用 createReactAgent 或自定义 Agent
- LLM 决定使用哪个 Tool
- 不再手动规划步骤序列

---

## 3. 核心模块设计

### 3.1 StateSchema 定义

```typescript
// src/states/agentState.ts

import { StateSchema, MessagesValue } from "@langchain/langgraph";
import { z } from "zod";

export const AgentState = new StateSchema({
  // 任务描述
  task: z.string(),

  // 对话历史 (LangGraph 内置)
  messages: MessagesValue,

  // 当前执行计划
  plan: z
    .object({
      nodes: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          action: z.any(),
        }),
      ),
      edges: z.array(
        z.object({
          from: z.string(),
          to: z.string(),
          type: z.string(),
        }),
      ),
    })
    .optional(),

  // 当前执行步骤
  currentStep: z.number().optional(),

  // 执行结果
  result: z
    .object({
      success: z.boolean(),
      output: z.any().optional(),
      error: z
        .object({
          code: z.string(),
          message: z.string(),
          recoverable: z.boolean().optional(),
        })
        .optional(),
      duration: z.number().optional(),
    })
    .optional(),

  // 记忆数据
  memory: z.record(z.any()).optional(),

  // 验证结果
  verification: z
    .object({
      verified: z.boolean(),
      type: z.string(),
      message: z.string().optional(),
    })
    .optional(),

  // 重试计数
  retryCount: z.number().optional(),

  // 页面上下文
  pageContext: z
    .object({
      url: z.string().optional(),
      title: z.string().optional(),
      uiGraph: z.any().optional(),
    })
    .optional(),
});
```

### 3.2 Graph 节点设计

#### 3.2.1 Planner Node (规划节点)

```typescript
// src/nodes/plannerNode.ts

import { GraphNode } from "@langchain/langgraph";
import { AgentState } from "../states/agentState";
import { z } from "zod";

const PlanInput = z.object({
  task: z.string(),
  context: z
    .object({
      currentUrl: z.string().optional(),
      previousResult: z.any().optional(),
      pageStructure: z.any().optional(),
    })
    .optional(),
});

export const plannerNode: GraphNode<typeof AgentState> = async (
  state,
  config,
) => {
  const { task } = state;
  const context = state.pageContext || {};

  // 调用 LLM 生成计划
  const llm = getLLMClient();
  const response = await llm.chat([
    {
      role: "system",
      content: PLANNER_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `任务: ${task}\n当前页面: ${context.url}\n标题: ${context.title}`,
    },
  ]);

  const plan = JSON.parse(response.content);

  return {
    plan,
    currentStep: 0,
  };
};
```

#### 3.2.2 Executor Node (执行节点)

```typescript
// src/nodes/executorNode.ts

import { GraphNode } from "@langchain/langgraph";
import { AgentState } from "../states/agentState";

export const executorNode: GraphNode<typeof AgentState> = async (
  state,
  config,
) => {
  const { plan, currentStep } = state;

  if (!plan || !plan.nodes || plan.nodes.length === 0) {
    return {
      result: {
        success: false,
        error: { code: "NO_PLAN", message: "No plan to execute" },
      },
    };
  }

  const currentNode = plan.nodes[currentStep];
  if (!currentNode) {
    return {
      result: { success: true, output: null },
    };
  }

  // 执行当前节点 action
  const toolResult = await executeTool(currentNode.action);

  return {
    result: toolResult,
    currentStep: currentStep + 1,
  };
};
```

#### 3.2.3 Verifier Node (验证节点)

```typescript
// src/nodes/verifyNode.ts

import { GraphNode } from "@langchain/langgraph";
import { AgentState } from "../states/agentState";

export const verifyNode: GraphNode<typeof AgentState> = async (
  state,
  config,
) => {
  const { result, plan, currentStep } = state;

  if (!result) {
    return {
      verification: {
        verified: false,
        type: "no_result",
        message: "No result to verify",
      },
    };
  }

  // 验证执行结果
  const verified = verifyResult(result, plan, currentStep);

  if (verified) {
    return {
      verification: {
        verified: true,
        type: "success",
        message: "Action verified successfully",
      },
    };
  } else {
    return {
      verification: {
        verified: false,
        type: "failed",
        message: result.error?.message || "Action verification failed",
      },
      retryCount: (state.retryCount || 0) + 1,
    };
  }
};

function verifyResult(result: any, plan: any, step: number): boolean {
  if (!result.success) {
    return false;
  }

  // 根据 action 类型进行特定验证
  const action = plan?.nodes?.[step]?.action;
  if (!action) return true;

  return true;
}
```

#### 3.2.4 Memory Node (记忆节点)

```typescript
// src/nodes/memoryNode.ts

import { GraphNode } from "@langchain/langgraph";
import { AgentState } from "../states/agentState";

export const memoryNode: GraphNode<typeof AgentState> = async (
  state,
  config,
) => {
  const { result, task, pageContext } = state;

  // 记录到 Memory Store
  await recordToMemory({
    task,
    result,
    url: pageContext?.url,
    timestamp: Date.now(),
  });

  return {
    memory: {
      lastResult: result,
      lastTask: task,
    },
  };
};
```

### 3.3 Tools 设计

#### 3.3.1 Browser Tool

```typescript
// src/tools/browserTool.ts

import { tool } from "@langchain/core/tools";
import { z } from "zod";

const BrowserParams = z.object({
  action: z.enum([
    "goto",
    "click",
    "input",
    "wait",
    "extract",
    "screenshot",
    "evaluate",
  ]),
  selector: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
  timeout: z.number().optional(),
  waitFor: z.string().optional(),
});

export const browserTool = tool(
  async (params, config) => {
    const { action, selector, text, url, timeout, waitFor } = params;

    // 从 config 获取 browser 实例
    const browser = getBrowserFromConfig(config);

    switch (action) {
      case "goto":
        await browser.goto(url, { timeout: timeout || 30000 });
        return { success: true, url: browser.url() };

      case "click":
        await browser.click(selector, { timeout: timeout || 10000 });
        return { success: true };

      case "input":
        await browser.type(selector, text, { timeout: timeout || 10000 });
        return { success: true };

      case "wait":
        await browser.waitForSelector(selector, { timeout: timeout || 10000 });
        return { success: true };

      case "extract":
        const content = await browser.extract(selector);
        return { success: true, content };

      case "screenshot":
        const screenshot = await browser.screenshot();
        return { success: true, screenshot };

      case "evaluate":
        const evalResult = await browser.evaluate(selector);
        return { success: true, result: evalResult };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
  {
    name: "browser",
    description: `浏览器操作工具，允许 AI 执行以下操作：
- goto: 导航到指定 URL
- click: 点击页面元素
- input: 在输入框中输入文本
- wait: 等待元素出现
- extract: 提取页面内容
- screenshot: 截取当前页面截图
- evaluate: 执行 JavaScript 代码

使用此工具完成网页自动化任务。`,
    schema: BrowserParams,
  },
);
```

#### 3.3.2 CLI Tool

```typescript
// src/tools/cliTool.ts

import { tool } from "@langchain/core/tools";
import { z } from "zod";

const CLIParams = z.object({
  command: z.string().describe("要执行的命令"),
  args: z.array(z.string()).optional().describe("命令参数"),
  timeout: z.number().optional().describe("超时时间(毫秒)"),
});

export const cliTool = tool(
  async (params, config) => {
    const { command, args, timeout = 30000 } = params;

    // 检查白名单
    const allowed = checkWhitelist(command);
    if (!allowed) {
      return {
        success: false,
        error: `Command not allowed: ${command}`,
      };
    }

    // 执行命令
    const result = await executeCommand(command, args, timeout);

    return result;
  },
  {
    name: "cli",
    description: `系统命令执行工具，用于执行白名单内的系统命令。
    
允许的命令示例：
- git: status, pull, push, clone, log
- npm: install, run, test, build
- ls, cd, mkdir, rm, cp, mv

使用此工具完成文件操作和开发任务。`,
    schema: CLIParams,
  },
);
```

#### 3.3.3 Vision Tool

```typescript
// src/tools/visionTool.ts

import { tool } from "@langchain/core/tools";
import { z } from "zod";

const VisionParams = z.object({
  action: z.enum(["ocr", "analyze", "extract_text", "describe"]),
  image_path: z.string().describe("图片路径或 URL"),
  prompt: z.string().optional().describe("分析提示"),
  language: z.string().optional().describe("输出语言"),
});

export const visionTool = tool(
  async (params, config) => {
    const { action, image_path, prompt, language = "zh-CN" } = params;

    switch (action) {
      case "ocr":
        const text = await performOCR(image_path);
        return { success: true, text };

      case "analyze":
        const analysis = await analyzeImage(image_path, prompt);
        return { success: true, analysis };

      case "extract_text":
        const extracted = await extractTextFromImage(image_path);
        return { success: true, text: extracted };

      case "describe":
        const description = await describeImage(image_path);
        return { success: true, description };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
  {
    name: "vision",
    description: `视觉处理工具，用于分析图片和屏幕内容。
    
支持的操作：
- ocr: 光学字符识别，提取图片中的文字
- analyze: 使用 AI 分析图片内容
- extract_text: 提取图片中的文本内容
- describe: 描述图片内容

适用于截图分析、验证码识别等场景。`,
    schema: VisionParams,
  },
);
```

### 3.4 Checkpointer 设计

```typescript
// src/checkpointers/sqlite.ts

import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

export function createSqliteCheckpointer(dbPath: string = "./checkpoints.db") {
  return new SqliteSaver({
    connectionPath: dbPath,
  });
}

// 使用示例
const checkpointer = createSqliteCheckpointer();

const agent = workflow.compile({
  checkpointer,
  configurable: {
    thread_id: "user-session-1",
  },
});
```

### 3.5 Memory Store 设计

```typescript
// src/memory/agentMemory.ts

import { MemoryStore, InMemoryStore } from "@langchain/langgraph";
import { z } from "zod";

const MemorySchema = z.object({
  task: z.string(),
  result: z.any(),
  timestamp: z.number(),
  url: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export class AgentMemory {
  private store: MemoryStore;

  constructor(store?: MemoryStore) {
    this.store = store || new InMemoryStore();
  }

  // 记录任务执行
  async record(
    task: string,
    result: any,
    context?: {
      url?: string;
      tags?: string[];
    },
  ) {
    const memory = {
      task,
      result,
      timestamp: Date.now(),
      url: context?.url,
      tags: context?.tags,
    };

    await this.store.put(["memories"], `task_${Date.now()}`, memory);
  }

  // 搜索相关记忆
  async search(query: string, limit: number = 5) {
    return await this.store.search(["memories"], { query, limit });
  }

  // 获取最近记忆
  async getRecent(limit: number = 10) {
    const memories = await this.store.search(["memories"], { limit });

    return memories.map((m) => m.value);
  }
}
```

---

## 4. 文件结构

### 4.1 删除的文件

```
src/core/runtime/TaskEngine.ts          # 原任务引擎
src/core/planner/PlanExecutor.ts        # 原计划执行器
src/core/planner/TaskPlanner.ts         # 原任务规划器
src/recovery/recoveryEngine.ts          # LangGraph 内置
src/memory/shortTermMemory.ts           # 替换为 Memory Store
src/browser/uiGraph.ts                  # LangGraph 管理
src/browser/observer.ts                 # LangGraph 管理
src/executor/verifier.ts                # 迁移到 State Validation
src/core/executor/BrowserExecutor.ts    # 封装为 Tool
src/core/executor/CLIExecutor.ts        # 封装为 Tool
src/core/executor/VisionExecutor.ts     # 封装为 Tool
```

### 4.2 新增的文件

```
src/
├── agents/
│   ├── graphAgent.ts          # LangGraph StateGraph 定义
│   └── reactAgent.ts          # ReAct Agent 定义
│
├── nodes/
│   ├── plannerNode.ts         # 规划节点
│   ├── executorNode.ts        # 执行节点
│   ├── verifyNode.ts          # 验证节点
│   └── memoryNode.ts          # 记忆节点
│
├── tools/
│   ├── browserTool.ts         # 浏览器工具
│   ├── cliTool.ts             # CLI 工具
│   └── visionTool.ts          # Vision 工具
│
├── checkpointers/
│   └── sqlite.ts              # SQLite Checkpointer
│
├── memory/
│   └── agentMemory.ts         # Memory Store 封装
│
├── states/
│   └── agentState.ts          # StateSchema 定义
│
└── config/
    └── langchain.ts           # LangChain 配置
```

### 4.3 修改的文件

```
src/main/ipcHandlers.ts          # 适配新 Agent
src/renderer/App.tsx           # 适配新执行模式
package.json                   # 添加 LangChain 依赖
```

---

## 5. 实施计划

### 5.1 详细时间线

| 阶段        | 周次       | 任务                                     | 交付物                        |
| ----------- | ---------- | ---------------------------------------- | ----------------------------- |
| **Phase 1** | Week 1-2   | 项目初始化 + 依赖安装 + StateSchema 设计 | package.json, agentState.ts   |
| **Phase 2** | Week 3-4   | Graph 搭建 + 基础 Nodes 实现             | graphAgent.ts, plannerNode.ts |
| **Phase 3** | Week 5-6   | Tools 封装 (Browser/CLI)                 | browserTool.ts, cliTool.ts    |
| **Phase 4** | Week 7-8   | Checkpointer 集成 + 任务持久化           | sqlite.ts, 任务可恢复         |
| **Phase 5** | Week 9-10  | Memory Store + 记忆功能                  | agentMemory.ts                |
| **Phase 6** | Week 11-12 | Vision Tool 封装                         | visionTool.ts                 |
| **Phase 7** | Week 13-14 | LangSmith 集成 + 可观测性                | 调试能力                      |
| **Phase 8** | Week 15-16 | 测试 + 优化 + 发布                       | v0.4 Release                  |

### 5.2 依赖包

```json
{
  "dependencies": {
    "@langchain/langgraph": "^0.0.50",
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "@langchain/langgraph-checkpoint-sqlite": "^0.0.1"
  }
}
```

---

## 6. 成功指标

| 指标       | v0.3   | v0.4 目标        | 说明                |
| ---------- | ------ | ---------------- | ------------------- |
| 任务成功率 | 85-95% | **90-98%**       | 更标准的 Agent 流程 |
| 代码行数   | -      | **-30%**         | 复用 LangGraph      |
| 恢复能力   | 手动   | **内置**         | Durable Execution   |
| 可观测性   | 手动   | **LangSmith**    | 运行时追踪          |
| 内存管理   | Map    | **Memory Store** | 语义搜索            |

---

### 6.1 测试指标

| 测试类型 | 覆盖率目标   |
| -------- | ------------ |
| 单元测试 | >80%         |
| 集成测试 | >60%         |
| E2E 测试 | 核心场景覆盖 |

---

_最后更新: 2026-03-29_
