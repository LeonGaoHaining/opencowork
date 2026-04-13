# OpenCowork 更新日志

| 版本    | 日期       | 状态   |
| ------- | ---------- | ------ |
| v0.10.5 | 2026-04-14 | 已发布 |
| v0.10.4 | 2026-04-14 | 已发布 |
| v0.10.3 | 2026-04-11 | 已发布 |
| v0.10.2 | 2026-04-10 | 已发布 |
| v0.10.1 | 2026-04-09 | 已发布 |
| v0.9.0  | 2026-04-07 | 已发布 |
| v0.8.9  | 2026-04-06 | 已发布 |
| v0.7.6  | 2026-04-01 | 已发布 |
| v0.4.0  | 2026-03-29 | 规划中 |
| v0.3.0  | 2026-03-29 | 已发布 |
| v0.2.3  | 2026-03-29 | 已发布 |

---

## v0.10.5 (2026-04-14) - 浏览器稳定性修复 🐛

### 版本目标

修复 headed 浏览器在首次任务完成后异常关闭的问题，支持连续执行多个浏览器任务

### 核心变更

| 模块            | 变更类型 | 说明                                            |
| --------------- | -------- | ----------------------------------------------- |
| BrowserExecutor | 修复     | 添加 page.isClosed() 检查，浏览器关闭时自动重启 |

### 功能清单

- ✅ 浏览器异常关闭后自动重新启动
- ✅ 支持连续执行多个浏览器任务
- ✅ 提升长任务运行可靠性

---

## v0.10.4 (2026-04-14) - 浏览器视口自适应 🪟

### 版本目标

让 headed 浏览器窗口像普通 Chrome 一样工作，拖拽时内容自然适应窗口大小

### 核心变更

| 模块                | 变更类型 | 说明                                          |
| ------------------- | -------- | --------------------------------------------- |
| BrowserExecutor     | 重构     | viewport: null 让页面跟随 OS 窗口大小         |
| launchHeadedBrowser | 重构     | 移除 --start-maximized 和固定 defaultViewport |

### 功能清单

- ✅ 拖拽窗口时页面内容自然适应
- ✅ 还原 Chrome 原生窗口行为
- ✅ 移除固定视口限制

---

## v0.10.3 (2026-04-11) - CDP 连接增强

### 版本目标

增强 Agent 浏览器与 webview 的同步功能

### 核心变更

| 模块           | 变更类型 | 说明                           |
| -------------- | -------- | ------------------------------ |
| mainAgent.ts   | 增强     | 同步 URL + Title 到 webview    |
| ipcHandlers.ts | 增强     | browser:syncWebview 支持 title |
| App.tsx        | 增强     | 接收 title 并更新地址栏        |

### 功能清单

- ✅ Agent 操作后同步 URL + 标题到 webview
- ✅ 地址栏显示当前页面标题
- ✅ 用户交互事件监听

---

## v0.10.2 (2026-04-10) - Browser Preview v2.0

### 版本目标

将预览区升级为真实浏览器，支持工具栏和 Agent 操作同步

### 核心变更

| 模块            | 变更类型 | 说明                           |
| --------------- | -------- | ------------------------------ |
| PreviewManager  | 重构     | BrowserWindow 替代 BrowserView |
| App.tsx Sidebar | 新功能   | webview 嵌入侧边栏             |
| Toolbar         | 新功能   | 地址栏、导航按钮、状态指示     |
| BrowserExecutor | 新功能   | CDP 连接方法                   |
| mainAgent.ts    | 新功能   | Agent 操作后同步 webview       |
| IPC Handlers    | 新功能   | browser:webviewNavigate        |

### 功能清单

- ✅ 侧边栏显示真实浏览器（webview）
- ✅ 工具栏：←→↻× 按钮、地址栏
- ✅ Agent 操作后 URL 同步到 webview
- ✅ 三种预览模式：sidebar/collapsible/detached
- ✅ 启用 webviewTag

### Bug 修复

- 修复 PreviewManager 默认模式为 sidebar
- 修复 App.tsx 侧边栏缺少 toolbar 问题
- 修复 preview:setMode IPC 通道

---

## v0.10.1 (2026-04-09) - IMConfigPanel + ConnectionStatus

### 版本目标

IM 平台配置可视化，无需手动编辑配置文件

### 核心变更

| 模块                    | 变更类型 | 说明                     |
| ----------------------- | -------- | ------------------------ |
| IMConfigPanel           | 新功能   | IM 平台配置 UI 组件      |
| IMButton                | 新功能   | ControlBar 状态指示器    |
| ConnectionStatusManager | 新功能   | 连接状态实时管理         |
| IPC Handlers            | 新功能   | im:load/save/test/status |

### Bug 修复

- TaskEngine.cancel() 调用错误
- IPC 返回值自动包装问题
- 配置文件路径解析问题
- Agent 未初始化问题

### 优化

- Agent 预初始化
- IPC 层 NO_WRAP_CHANNELS 机制

---

## v0.9.0 (2026-04-07) - IMConfigPanel Initial

## v0.4.0 (规划中) - LangChain/LangGraph 重构

### 版本目标

全量采用 LangChain/LangGraph TypeScript 版本替换现有架构，实现标准化 Agent 执行流程

### 核心变更

| 模块     | v0.3 实现               | v0.4 LangGraph 实现        |
| -------- | ----------------------- | -------------------------- |
| 状态管理 | Map<string, TaskHandle> | StateSchema + Checkpointer |
| 任务执行 | PlanExecutor 线性执行   | StateGraph Nodes/Edges     |
| 规划器   | TaskPlanner LLM 调用    | Agent Node + Tools         |
| 恢复机制 | RecoveryEngine 手动     | 内置 Durable Execution     |
| 记忆     | ShortTermMemory 内存Map | Memory Store               |
| 验证     | Verifier 手动           | Graph State Validation     |
| 可观测   | console.log 手动        | LangSmith 集成             |

### 实施计划

| 阶段    | 周次       | 任务                                       |
| ------- | ---------- | ------------------------------------------ |
| Phase 1 | Week 1-2   | LangChain/LangGraph 引入，StateSchema 设计 |
| Phase 2 | Week 3-4   | StateGraph 重构，基础 Nodes 实现           |
| Phase 3 | Week 5-6   | Browser/CLI Tools 封装                     |
| Phase 4 | Week 7-8   | Checkpointer 持久化                        |
| Phase 5 | Week 9-10  | Memory Store 集成                          |
| Phase 6 | Week 11-12 | Vision Tool 封装                           |
| Phase 7 | Week 13-14 | LangSmith 集成                             |
| Phase 8 | Week 15-16 | 测试与优化                                 |

### 预期指标

| 指标       | v0.3   | v0.4 目标 |
| ---------- | ------ | --------- |
| 任务成功率 | 85-95% | 90-98%    |
| 代码复用   | -      | +40%      |
| 恢复能力   | 手动   | 内置      |
| 可观测性   | 手动   | LangSmith |

### 里程碑

- **Week 4**: 核心 Graph 可运行
- **Week 8**: 任务可持久化恢复
- **Week 12**: Vision Tool 完成
- **Week 16**: v0.4 发布

---

## v0.3.0 (2026-03-29) - 工业级Browser Agent架构

### 版本目标

实现工业级Browser Agent架构，目标任务成功率达到85-95%

### 新增功能

1. **UIGraph语义层** - 将DOM转换为语义化元素图谱，LLM只看到语义ID而非原始selector
2. **Observer观察者** - 页面观察者类，失败后捕获UIGraph
3. **Verifier验证层** - 每步执行后验证页面状态变化
4. **RecoveryEngine恢复引擎** - 独立的LLM驱动恢复决策系统
5. **ShortTermMemory短期记忆** - 记录成功/失败轨迹用于学习
6. **反爬虫机制文档** - 记录现有反爬虫实现和已知弱点

### 核心架构改进

```
Observe → Decide → Act → Verify → Recovery → Memory
         ↑                              ↓
         └──────── 失败后触发 ←────────┘
```

### 新增文件

| 文件                             | 用途                    |
| -------------------------------- | ----------------------- |
| `src/types/uiElement.ts`         | UI元素和UIGraph类型定义 |
| `src/types/verifier.ts`          | Verifier类型定义        |
| `src/browser/uiGraph.ts`         | UIGraph语义图构建器     |
| `src/browser/observer.ts`        | 页面观察者类            |
| `src/executor/verifier.ts`       | 验证层                  |
| `src/recovery/recoveryEngine.ts` | 独立恢复引擎            |
| `src/memory/shortTermMemory.ts`  | 短期记忆                |

### 预期指标

| 指标              | v0.2 | v0.3目标 |
| ----------------- | ---- | -------- |
| Task success rate | ~65% | 85-95%   |
| Click accuracy    | ~80% | >95%     |
| Step latency      | 2-5s | 1-3s     |
| 失败后恢复率      | ~50% | >80%     |

---

## v0.2.3 (2026-03-29)

### 新增功能

1. **元素滚动到视口** - 在 click 和 input 操作前添加 `scrollIntoViewIfNeeded()`，确保元素在可视区域再执行操作

2. **PressEnter 参数支持** - `browser:input` Action 支持 `pressEnter` 参数，输入完成后自动按 Enter 提交

### 修复问题

1. **评论区输入失败** - 修复元素在页面下方无法找到的问题，现在会先滚动到元素位置再输入

2. **Enter 键时机问题** - 输入后等待 100ms 再按 Enter，确保焦点稳定

3. **选择器解析问题** - 修复逗号分隔的选择器未正确拆分为数组的问题

4. **任务队列冲突** - 添加 `isTaskRunning()` 检查，防止多个任务并发执行

5. **选择器应用错误** - 修复 Replanner 将新选择器应用到所有节点的问题，改为只修改失败节点

6. **IPC 重复注册** - 修复 `ask:user:response` IPC 处理器重复注册导致崩溃

7. **页面结构增强** - 添加 `getPageStructure()` 方法，提取页面 DOM 结构及 30 个链接的 boundingBox 坐标

8. **登录弹窗检测** - 改为任务执行期间检测，而非启动时检测

### 优化改进

1. **预览刷新速度** - fps 24, quality 20, maxWidth 800，提升预览流畅度

2. **浏览器高度自适应** - 移除 maxHeight 限制，preview 区域自动填充

3. **LLM 推理模式** - 启用 Azure OpenAI 的 `reasoning_effort: 'medium'` 模式

4. **选择器生成优化** - TaskPlanner 系统提示词增强，强制 LLM 输出 CSS 选择器

5. **会话持久化** - SessionManager + sessionStore + SessionPanel，支持任务上下文记忆

### 依赖

- playwright-extra: ^4.3.6
- playwright-stealth: ^0.0.1
- zustand: ^4.5.7

---

## v0.2.2 (2026-03-28)

### 新增功能

1. **SessionPanel 组件** - UI 显示会话历史

2. **页面结构提取** - getPageStructure() 提取页面链接和容器信息

### 修复问题

1. **预览高度限制** - 移除 maxHeight 限制

2. **Enter 双重发送** - 移除 click 失败时的 Enter fallback

---

## v0.2.1 (2026-03-28)

### 修复问题

1. **预览速度慢** - 优化 ScreencastService fps 和 quality

2. **登录弹窗误判** - 优化检测逻辑

---

## v0.2.0 (2026-03-28)

### 新增功能

1. **ask:user 完整实现** - AskUserExecutor + IPC 完整流程
2. **Replanner 动态重规划** - LLM 决策重试策略，最多 3 次重试
3. **Selector 稳定性改进** - 多策略选择器 + fallbacks
4. **ScreencastService** - 实时截图预览（替代 BrowserView 方案）

---

## v0.1.0 (2026-03-27)

### 首次发布 (MVP)

- Electron + React + Vite 项目
- TaskPlanner 任务规划
- PlanExecutor 计划执行
- TaskEngine 任务引擎
- BrowserExecutor 浏览器自动化
- CLIExecutor 命令执行
- ChatUI / ControlBar / TakeoverModal 组件

---

_文档创建日期: 2026-03-29_
