# Release v0.4.0

**发布日期**: 2026-03-29  
**Tag**: v0.4.0  
**Commit**: 1e206a9

---

## 概述

**v0.4.0** 是 OpenCowork 的重大架构升级版本，实现了基于 **LangChain/LangGraph TypeScript** 的全量重构，从线性执行流程升级为标准化的 Graph-based Agent 执行框架。

---

## 核心变更

| 模块         | v0.3                  | v0.4                        |
| ------------ | --------------------- | --------------------------- |
| **执行框架** | PlanExecutor 线性执行 | LangGraph StateGraph        |
| **Agent**    | 单一体                | createReactAgent + SubAgent |
| **持久化**   | 无                    | MemorySaver Checkpointer    |
| **记忆**     | ShortTermMemory Map   | Memory Store                |
| **可观测**   | console.log           | agentLogger                 |
| **IPC**      | 直接调用              | 桥接层封装                  |

---

## 架构图

```
User Task
    ↓
┌─────────────────────────────────────────────┐
│           MainAgent (createReactAgent)        │
│  ┌─────────────┐   ┌─────────────┐         │
│  │   Planner   │ → │  Executor   │         │
│  │   Node      │   │   Node      │         │
│  └─────────────┘   └─────────────┘         │
└─────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│           SubAgents                          │
│  ├── BrowserSubAgent (浏览器自动化)          │
│  └── BaseSubAgent (通用执行器)              │
└─────────────────────────────────────────────┘
           ↓
     MemorySaver + agentLogger
```

---

## 新增功能

### 1. LangChain/LangGraph 集成

- `createReactAgent` 替代自定义状态机
- StateSchema 标准化状态定义
- 内置 Durable Execution，任务可中断恢复

### 2. 主-子 Agent 架构

| 文件                                      | 说明                   |
| ----------------------------------------- | ---------------------- |
| `src/agents/mainAgent.ts`                 | 主 Agent，负责任务编排 |
| `src/agents/subagents/browserSubAgent.ts` | 浏览器自动化子 Agent   |
| `src/agents/subagents/baseSubAgent.ts`    | 通用执行子 Agent       |
| `src/ipc/agentIpcBridge.ts`               | IPC 通信桥接层         |

### 3. 持久化与记忆

| 文件                                     | 说明                  |
| ---------------------------------------- | --------------------- |
| `src/checkpointers/agentCheckpointer.ts` | MemorySaver 持久化    |
| `src/memory/agentMemory.ts`              | Memory Store 记忆管理 |

### 4. 可观测性

| 文件                        | 说明                         |
| --------------------------- | ---------------------------- |
| `src/agents/agentLogger.ts` | 本地日志系统，替代 LangSmith |

### 5. 配置与白名单

| 文件                      | 说明                |
| ------------------------- | ------------------- |
| `src/config/whitelist.ts` | CLI/路径/网络白名单 |
| `src/config/constants.ts` | 系统常量            |

---

## 技术指标

| 指标       | v0.3   | v0.4 目标 | 提升 |
| ---------- | ------ | --------- | ---- |
| 任务成功率 | 85-95% | 90-98%    | +5%  |
| 代码复用   | -      | +40%      | -    |
| 恢复能力   | 手动   | 内置      | -    |
| 启动速度   | -      | +50%      | -    |

---

## 升级说明

### Breaking Changes

- 任务执行流程完全重构，旧版任务状态不兼容
- 需要重新配置 LLM（推荐 Azure OpenAI 或 OpenAI）

### 推荐配置

```json
{
  "llm": {
    "provider": "azure",
    "model": "gpt-4o"
  }
}
```

---

## 提交记录

| Commit    | 说明                                                 |
| --------- | ---------------------------------------------------- |
| `1e206a9` | feat: v0.4 - LangChain/LangGraph 重构                |
| `6e91c8d` | feat: v0.4 Phase 4 - Memory Store                    |
| `dc3ecca` | feat: v0.4 Phase 3 - Checkpointer 持久化             |
| `780cc9d` | feat: v0.4 Phase 2 - SubAgent 框架和 IPC 桥接        |
| `64c4f04` | feat: v0.4 Phase 1 - LangChain 依赖安装和主Agent框架 |

---

## 致谢

感谢 LangChain 团队提供的标准化 Agent 框架，以及 Claude 官方 Skill 规范的启发。

---

**Full Changelog**: https://github.com/LeonGaoHaining/opencowork/compare/v0.3...v0.4.0
