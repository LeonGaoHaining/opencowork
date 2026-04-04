# OpenCowork Agent Guidelines

This file contains guidelines for agents working on the OpenCowork codebase.

## Build / Lint / Test Commands

```bash
# Development
npm run dev                          # Start Vite dev server
npm run electron:dev                 # Build main/preload/renderer + run Electron

# Build
npm run build                        # Full build: tsc + vite
npm run build:main                   # Build main process only
npm run build:preload                # Build preload only
npm run build:renderer               # Build renderer only

# Testing
npm test                             # Run all tests (watch mode)
npm run test:run                     # Run tests once
npm run test:coverage                # Run with coverage

# Linting & Formatting
npm run lint                         # ESLint check
npm run lint:fix                     # ESLint auto-fix
npm run format                       # Prettier format all files
```

### Running a Single Test

```bash
# Using vitest with file filter
npx vitest run src/core/action/__tests__/ActionValidator.test.ts

# Or with specific test name
npx vitest run -t "should validate"
```

## Code Style Guidelines

### TypeScript

- Use explicit types for function parameters and return values
- Use `interface` for object shapes, `type` for unions/intersections
- Avoid `any`, use `unknown` when type is truly unknown

```typescript
// Good
interface ActionResult {
  success: boolean;
  error?: { code: string; message: string; recoverable: boolean };
  duration: number;
}

// Avoid
const result: any = ...
```

### Naming Conventions

- **Files**: PascalCase for components (`SessionPanel.tsx`), camelCase for others (`taskEngine.ts`)
- **Classes**: PascalCase (`class BrowserExecutor`)
- **Interfaces**: PascalCase with `I` prefix optional (`ActionResult` not `IActionResult`)
- **Constants**: UPPER_SNAKE_CASE for config (`CLI_WHITELIST`)
- **Functions**: camelCase, verb-first (`executeAction`, `getPageStructure`)
- **Booleans**: `is*`, `has*`, `can*` prefix (`isExecuting`, `hasPopup`)

### Imports

- Use absolute imports from `src/` root
- Group imports: external → internal → relative
- Use named exports preferred over default

```typescript
// Good
import { ActionResult, AnyAction } from '../action/ActionSchema';
import { getLLMClient } from '../../llm/OpenAIResponses';
import { ScreencastService } from './ScreencastService';

// Avoid
import ActionSchema from '../action/ActionSchema';
```

### Error Handling

- Use custom error codes for machine-readable errors
- Always include `recoverable: boolean` for actionable errors
- Log errors with context using `[ClassName]` prefix

```typescript
return {
  success: false,
  error: {
    code: 'SELECTOR_ERROR',
    message: 'Element not found: ' + selector,
    recoverable: true,
  },
  duration: Date.now() - startTime,
};
```

### Async / Promise

- Always handle errors in async functions
- Use async/await over raw Promises
- Include timeout for long-running operations

```typescript
// Good
async execute(action: AnyAction): Promise<ActionResult> {
  try {
    const result = await this.page.locator(selector).click();
    return { success: true, duration: Date.now() - startTime };
  } catch (error) {
    return { success: false, error: { code: 'CLICK_FAILED', message: error.message, recoverable: true } };
  }
}
```

### React / Component Guidelines

- Functional components with hooks
- Use Zustand for state management
- Props interfaces should be explicit

```typescript
interface SessionPanelProps {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function SessionPanel({ sessions, activeId, onSelect }: SessionPanelProps) { ... }
```

### Logging Convention

Use `[ClassName]` prefix for all log messages:

```typescript
console.log('[BrowserExecutor] Input to:', selector);
console.error('[TaskEngine] Node error:', error);
```

### Console Logging Levels

| Level           | Usage                                |
| --------------- | ------------------------------------ |
| `console.log`   | Normal operation, state transitions  |
| `console.warn`  | Recoverable issues, retries          |
| `console.error` | Fatal errors, unrecoverable failures |

### File Organization

```
src/
├── main/           # Electron main process
├── renderer/       # React UI (components, stores)
├── core/           # Core business logic
│   ├── action/     # Action definitions + validation
│   ├── executor/   # Action executors (Browser, CLI, etc.)
│   ├── planner/    # Task planning (TaskPlanner, Replanner)
│   └── runtime/    # Runtime (TaskEngine)
├── llm/            # LLM client integration
└── config/         # Configuration files
```

### Action Schema Patterns

Follow the pattern in `ActionSchema.ts`:

- Each action type has an interface extending `BaseAction`
- Use `ActionType` enum for type discrimination
- Params must match the action's parameter structure

```typescript
export enum ActionType {
  BROWSER_NAVIGATE = 'browser:navigate',
  BROWSER_CLICK = 'browser:click',
  CLI_EXECUTE = 'cli:execute',
  // ...
}

export interface BrowserClickAction extends BaseAction {
  type: ActionType.BROWSER_CLICK;
  params: {
    selector: string;
    index?: number;
    textMatch?: string;
  };
}
```

### Important Project Conventions

1. **Backup before modifying**: Always backup files before editing

   ```bash
   # Move backup files to backup folder
   cp file.ts file.ts.bak.$(date +%Y%m%d_%H%M%S)
   mv file.ts.bak.* ./backup/
   ```

2. **LLM Integration**: Use `getLLMClient()` from `../../llm/OpenAIResponses`

3. **Browser Automation**: Use Playwright through `playwright-extra` with stealth plugin

4. **State Management**: Use Zustand stores in `src/renderer/stores/`

5. **IPC Communication**: Main ↔ Renderer via `window.electron.on()` and `ipcRenderer.invoke()`

### Testing Patterns

- Use vitest with @testing-library
- Test files alongside source: `src/core/executor/__tests__/CLIExecutor.test.ts`
- Use `describe`/`it`/`expect` from vitest

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CLIExecutor } from '../CLIExecutor';

describe('CLIExecutor', () => {
  let executor: CLIExecutor;
  beforeEach(() => { executor = new CLIExecutor(); });

  it('should execute whitelisted commands', async () => { ... });
});
```

### Documentation Updates

- Update CHANGELOG.md for version changes
- Update USER_GUIDE.md for feature changes
- Update relevant SPEC files for specification changes

## 代码审核上下文

### AI 专用设备场景

当进行代码审核时，请记住这是一个 **AI 专用设备**部署场景：

#### 安全限制放宽

- CLI 注入、路径穿越、黑名单绕过等可忽略
- Shell 危险命令（`rm -rf`、`cat *` 等）可接受
- XSS 问题在单用户场景下影响较小

#### 审核重点（按优先级）

| 优先级 | 问题类型 | 说明                    |
| ------ | -------- | ----------------------- |
| **P0** | 内存泄漏 | long-running OOM        |
| **P0** | 进程崩溃 | uncaught exception      |
| **P0** | 资源泄漏 | cleanup() 未调用        |
| **P0** | 任务挂起 | 无超时保护              |
| **P1** | 竞态条件 | 可能冻结/崩溃           |
| **P1** | 数据损坏 | JSON.parse 无 try-catch |
| **P2** | 类型安全 | 可忽略大部分            |

#### 可忽略的问题

- CLI Executor 安全限制
- 路径穿越漏洞
- 黑名单绕过
- 单用户 XSS
- SQL 注入（内部数据）

### 问题优先级定义

- **P0**: 导致进程崩溃、内存泄漏、设备冻结
- **P1**: 导致功能异常、数据丢失、性能下降
- **P2**: 代码质量、技术债务、边缘情况

---

## 代码审核修复记录

### 2026-03-31 代码审核修复 (v0.7)

#### P0 关键问题修复

| 问题 | 文件                                                     | 修复内容                              |
| ---- | -------------------------------------------------------- | ------------------------------------- |
| P0-1 | `BrowserExecutor.ts:638`                                 | cleanup() 添加 `screencast.stop()`    |
| P0-2 | `BrowserExecutor.ts:109`                                 | 初始化嵌套 try-catch 清理             |
| P0-3 | `CLIExecutor.ts:57`                                      | 添加 timeout + callback try-catch     |
| P0-4 | `TaskEngine.ts:504,674`                                  | wait 函数 cleanup 跟踪                |
| P0-5 | `scheduler.ts:195-224`                                   | Cron/Interval/One-time 回调 try-catch |
| P0-6 | `taskQueue.ts:85`                                        | 连续空检查 + 降频                     |
| P0-7 | `taskExecutor.ts:15`                                     | 任务超时保护（默认5分钟）             |
| P0-8 | `memoryStore.ts`, `historyStore.ts`, `historyService.ts` | 大小限制 + mutex 清理                 |

#### P1 高优先级问题修复

| 问题 | 文件                                 | 修复内容                   |
| ---- | ------------------------------------ | -------------------------- |
| P1-1 | `DispatchService.ts:272`             | statusMap 使用插入顺序数组 |
| P1-2 | `DispatchService.ts:104`             | taskQueue 大小限制         |
| P1-3 | `bindingStore.ts`, `sessionStore.ts` | 大小限制                   |
| P1-4 | `FeishuBot.ts:27`                    | axios timeout 30秒         |
| P1-5 | `mainAgent.ts:706,722`               | JSON.parse try-catch       |
| P1-6 | `agentLogger.ts:65`                  | toolDurations 限制100条    |

---

### 2026-04-01 第二轮代码审核修复 (v0.7.1)

#### P0 关键问题修复

| 问题 | 文件                                 | 修复内容                                               |
| ---- | ------------------------------------ | ------------------------------------------------------ |
| P0-1 | `renderer/stores/taskStore.ts`       | MAX_MESSAGES=500, MAX_LOGS=1000, MAX_ACTIVE_STEPS=200  |
| P0-2 | `renderer/stores/sessionStore.ts`    | MAX_SESSIONS=100, MAX_MESSAGES_PER_SESSION=200         |
| P0-3 | `skills/skillLoader.ts`              | MAX_MANIFEST_CACHE=200, LRU 淘汰                       |
| P0-4 | `memory/agentMemory.ts`              | MAX_ENTRIES=1000, FIFO 淘汰                            |
| P0-5 | `checkpointers/agentCheckpointer.ts` | cleanup() + resetCheckpointer()                        |
| P0-6 | `recovery/recoveryEngine.ts`         | MAX_STRATEGY_HISTORY=100, MAX_LLM_CALLS=500            |
| P0-7 | `browser/observer.ts`                | destroy() 方法                                         |
| P0-8 | `core/planner/PlanExecutor.ts`       | 已完整（BrowserExecutor.cleanup 包含 screencast.stop） |

#### P1 高优先级问题修复

| 问题 | 文件                                | 修复内容                       |
| ---- | ----------------------------------- | ------------------------------ |
| P1-1 | `skills/skillRunner.ts`             | cleanup() + resetSkillRunner() |
| P1-2 | `skills/skillMarket.ts`             | cleanup() + resetSkillMarket() |
| P1-3 | `renderer/stores/schedulerStore.ts` | MAX_TASKS=200                  |
| P1-4 | `memory/agentMemory.ts`             | 内置 try-catch                 |
| P1-5 | `core/planner/TaskPlanner.ts`       | simpleDecompose try-catch      |
| P1-6 | `core/planner/Replanner.ts`         | cleanup()                      |
| P1-7 | `browser/uiGraph.ts`                | page.evaluate 错误边界         |

---

### 2026-04-01 第三轮代码审核修复 (v0.7.2)

#### P0 关键问题修复

| 问题 | 文件                               | 修复内容                                                        |
| ---- | ---------------------------------- | --------------------------------------------------------------- |
| P0-1 | `main/SessionManager.ts`           | MAX_SESSIONS=100, JSON.parse try-catch, writeFileSync try-catch |
| P0-2 | `main/ipcHandlers.ts`              | 完善（已有 Promise 锁定）                                       |
| P0-3 | `core/executor/AskUserExecutor.ts` | resolve/reject 时删除 pendingRequests                           |
| P0-4 | `core/runtime/TaskEngine.ts`       | MAX_TASKS=500 + taskOrder + cleanup()                           |
| P0-5 | `core/runtime/TakeoverManager.ts`  | MAX_LISTENERS=100 + destroy()                                   |
| P0-6 | `llm/OpenAIResponses.ts`           | 添加 resetLLMClient()                                           |
| P0-7 | `preview/PreviewManager.ts`        | 增强 cleanup（检查 isDestroyed）                                |
| P0-8 | `agents/mainAgent.ts`              | 添加 clearAgentInstance() + finally 清理                        |

#### P1 高优先级问题修复

| 问题 | 文件                               | 修复内容                                      |
| ---- | ---------------------------------- | --------------------------------------------- |
| P1-1 | `llm/config.ts`                    | TOCTOU 修复（try-catch 替代 existsSync 检查） |
| P1-2 | `main/ipcHandlers.ts`              | 跳过（minor issue）                           |
| P1-3 | `core/planner/TaskPlanner.ts`      | parseLLMResponse JSON.parse 已内置 try-catch  |
| P1-4 | `core/planner/Replanner.ts`        | 已内置 try-catch                              |
| P1-5 | `core/executor/BrowserExecutor.ts` | regenerateSelector 添加 30s 超时              |

---

### 2026-04-01 第四轮代码审核修复 (v0.7.3)

#### P0 关键问题修复

| 问题 | 文件                                | 修复内容                                             |
| ---- | ----------------------------------- | ---------------------------------------------------- |
| P0-1 | `main/SessionManager.ts`            | create() 和 update() 中 writeFileSync 添加 try-catch |
| P0-2 | `agents/mainAgent.ts`               | agent.invoke() 添加 5 分钟超时保护                   |
| P0-3 | `agents/mainAgent.ts`               | extractSteps 中 JSON.parse 已内置 try-catch          |
| P0-4 | `im/feishu/FeishuBot.ts`            | parseMessage 中 JSON.parse 添加 try-catch            |
| P0-5 | `renderer/App.tsx`                  | 跳过（事件处理器较多，后续优化）                     |
| P0-6 | `renderer/stores/schedulerStore.ts` | setOpen 添加 .catch 错误处理                         |
| P0-6 | `renderer/stores/historyStore.ts`   | setFilter 添加 .catch 错误处理                       |

#### P1 高优先级问题修复

| 问题 | 文件                     | 修复内容                                     |
| ---- | ------------------------ | -------------------------------------------- |
| P1-1 | `scheduler/taskQueue.ts` | 跳过（minor issue）                          |
| P1-2 | `im/DispatchService.ts`  | 任务完成时删除 statusMap 条目                |
| P1-3 | `agents/agentLogger.ts`  | exportToFile 中 writeFileSync 添加 try-catch |

---

### 2026-04-01 第五轮代码审核修复 (v0.7.4)

#### P0 关键问题修复

| 问题 | 文件                              | 修复内容                                        |
| ---- | --------------------------------- | ----------------------------------------------- |
| P0-1 | `main/ipcHandlers.ts`             | Agent 初始化错误时确保 isAgentInitializing 重置 |
| P0-2 | `main/ipcHandlers.ts`             | Agent 初始化添加 60s 超时保护                   |
| P0-3 | `main/SessionManager.ts`          | ensureSessionsDir 使用 mkdirSync 避免 TOCTOU    |
| P0-4 | `main/SessionManager.ts`          | loadMeta 移除 existsSync 检查，使用 try-catch   |
| P0-5 | `core/runtime/TaskEngine.ts`      | getBrowserPage() 添加 null 检查                 |
| P0-6 | `core/runtime/TaskEngine.ts`      | ensureAgentModules 添加 Promise 锁定防止竞态    |
| P0-7 | `core/executor/ExecutorRouter.ts` | cleanup() 添加日志                              |
| P0-8 | `renderer/preview.tsx`            | 已修复（useEffect 返回 unsubscribe）            |

#### P1 高优先级问题修复

| 问题 | 文件                              | 修复内容                               |
| ---- | --------------------------------- | -------------------------------------- |
| P1-1 | `main/SessionManager.ts`          | saveMeta 已内置 try-catch              |
| P1-2 | `core/planner/PlanExecutor.ts`    | waitForResume 添加 5 分钟绝对超时      |
| P1-3 | `core/planner/Replanner.ts`       | cleanup() 已调用 cancelAll()           |
| P1-4 | `core/runtime/TakeoverManager.ts` | notifyListeners 添加 try-catch 保护    |
| P1-5 | `core/runtime/TaskEngine.ts`      | cleanup() 添加 executor.cleanup() 调用 |

### 2026-04-01 第六轮代码审核修复 (v0.7.5)

#### P0 关键问题修复

| 问题  | 文件                                    | 修复内容                                                |
| ----- | --------------------------------------- | ------------------------------------------------------- |
| P0-1  | `main/ipcHandlers.ts`                   | 已完成（Promise 锁定防止竞态）                          |
| P0-2  | `main/PreviewManager.ts`                | 已完成（try-catch around addBrowserView）               |
| P0-3  | `main/index.ts`                         | 已完成（添加 isDestroyed() 检查）                       |
| P0-4  | `core/runtime/TaskEngine.ts`            | 已完成（waitForPopupClosed 有 cleanup 跟踪）            |
| P0-5  | `core/runtime/TaskEngine.ts`            | 已完成（cancel() 添加 clearPopupWait/clearUserConfirm） |
| P0-6  | `core/runtime/TaskEngine.ts`            | 已完成（ensureAgentModules 有 Promise 锁定）            |
| P0-7  | `core/planner/Replanner.ts`             | 已完成（executeAskUser 已 await）                       |
| P0-8  | `renderer/App.tsx`                      | 已完成（8个事件处理器添加 try-catch）                   |
| P0-9  | `renderer/components/AskUserDialog.tsx` | 已完成（handleCancel 添加 try-catch）                   |
| P0-10 | `renderer/components/SessionPanel.tsx`  | 已完成（所有 handler 添加 try-catch）                   |
| P0-11 | `skills/skillLoader.ts`                 | 已完成（catch 块已有 console.warn）                     |
| P0-12 | `skills/skillMarket.ts`                 | 已完成（所有方法已有 try-catch）                        |
| P0-13 | `preview/PreviewManager.ts`             | 已完成（addBrowserView 有 try-catch）                   |
| P0-14 | `preview/PreviewManager.ts`             | 已完成（navigateTo 有 try-catch）                       |
| P0-15 | `browser/observer.ts`                   | 已完成（已有 destroy() 方法）                           |

#### P1 功能问题修复

| 问题 | 文件                                 | 修复内容                                    |
| ---- | ------------------------------------ | ------------------------------------------- |
| P1-1 | `main/SessionManager.ts`             | 已完成（添加 updateLocks 防止并发更新）     |
| P1-2 | `core/runtime/TaskEngine.ts`         | 已完成（takeover() 返回任务进度信息）       |
| P1-3 | `core/runtime/TaskEngine.ts`         | 已完成（使用 generateId() 生成唯一 ID）     |
| P1-4 | `history/historyService.ts`          | 已完成（releaseTaskMutex 在任务完成时调用） |
| P1-5 | `history/historyStore.ts`            | 已完成（添加 flushPendingWrites() 方法）    |
| P1-6 | `memory/shortTermMemory.ts`          | 已完成（添加 cleanup() 方法）               |
| P1-7 | `memory/agentMemory.ts`              | 已完成（添加 resetMemory() 函数）           |
| P1-8 | `main/ipc.ts`                        | 已完成（添加 cleanupIPC() 函数）            |
| P1-9 | `core/executor/ScreencastService.ts` | 已完成（已有 isDestroyed 检查）             |

#### P2 代码质量修复

| 问题 | 文件                                 | 修复内容                                    |
| ---- | ------------------------------------ | ------------------------------------------- |
| P2-1 | `renderer/components/ControlBar.tsx` | 已完成（handlePause/handleStop 调用 IPC）   |
| P2-2 | `core/action/ActionSchema.ts`        | 已完成（generateId 使用 Date.now + random） |
| P2-3 | `im/DispatchService.ts`              | 已完成（已有 MAX_STATUS_MAP_SIZE 限制）     |

### 2026-04-01 第七轮代码审核修复 (v0.7.1)

#### P0 关键问题修复

| 问题 | 文件                                   | 修复内容                                                  |
| ---- | -------------------------------------- | --------------------------------------------------------- |
| P0-1 | `scheduler/scheduler.ts`               | 添加 oneTimeTimers Map，使用 clearTimeout 清除 setTimeout |
| P0-2 | `core/runtime/TaskEngine.ts:760-786`   | waitForUserConfirm catch 块添加 resolve()                 |
| P0-3 | `core/executor/AskUserExecutor.ts`     | pendingRequests 改为模块级共享 Map                        |
| P0-4 | `core/planner/PlanExecutor.ts:246-265` | waitForResume 添加 settled 标志防止超时后继续轮询         |
| P0-5 | `core/planner/PlanExecutor.ts:312`     | getBrowserPage 添加 null 检查                             |

#### P1 功能问题修复

| 问题 | 文件                                 | 修复内容                                                      |
| ---- | ------------------------------------ | ------------------------------------------------------------- |
| P1-1 | `main/ipcHandlers.ts:104-116`        | 初始化超时返回错误而非继续执行                                |
| P1-2 | `main/ipcHandlers.ts:118`            | 添加 agent 非空检查                                           |
| P1-3 | `history/historyStore.ts:26-41`      | scheduleSqliteSync 改为 async，批量写入时 await flushToSqlite |
| P1-4 | `core/runtime/TaskEngine.ts:473-476` | executePlan catch 添加 throw error                            |
| P1-5 | `core/runtime/TaskEngine.ts:222`     | executePlan 开始时深拷贝 plan                                 |
| P1-6 | `core/planner/Replanner.ts:79`       | maxRetries 添加注释说明由外部控制                             |
| P1-7 | `main/SessionManager.ts:93-117`      | saveMeta 添加 3 次重试机制                                    |
| P1-8 | `main/SessionManager.ts:123`         | create() 添加 createLock 防止并发创建                         |

#### P2 代码质量修复

| 问题 | 文件                                   | 修复内容                        |
| ---- | -------------------------------------- | ------------------------------- |
| P2-1 | `core/planner/PlanExecutor.ts:304-306` | cleanup() 添加 stopScreencast() |
| P2-2 | `core/executor/BrowserExecutor.ts:38`  | 移除未使用的 retryCount         |

---

### 2026-04-01 第七轮代码审核修复 - 续 (v0.7.2)

#### P0 关键问题修复

| 问题 | 文件                                 | 修复内容                           |
| ---- | ------------------------------------ | ---------------------------------- |
| P0-1 | `core/runtime/TaskEngine.ts:473-476` | executePlan catch 添加 throw error |

#### P1 功能问题修复

| 问题 | 文件                                 | 修复内容                          |
| ---- | ------------------------------------ | --------------------------------- |
| P1-1 | `main/SessionManager.ts:93-117`      | saveMeta 添加 3 次重试 + 指数退避 |
| P1-2 | `main/SessionManager.ts:123`         | create() 添加 createLock 防止并发 |
| P1-3 | `core/runtime/TaskEngine.ts:222-259` | executePlan 深拷贝 plan 后执行    |

#### P2 代码质量修复

| 问题 | 文件                                  | 修复内容                     |
| ---- | ------------------------------------- | ---------------------------- |
| P2-1 | `core/executor/BrowserExecutor.ts:38` | 移除未使用的 retryCount 属性 |

---

### 2026-04-01 第八轮代码审核修复 (v0.7.4)

#### P1 功能问题修复

| 问题 | 文件                                  | 修复内容                    |
| ---- | ------------------------------------- | --------------------------- |
| P1-1 | `core/planner/TaskPlanner.ts:188-194` | LLM 调用添加 2 分钟超时保护 |

#### P2 代码质量修复

| 问题 | 文件                                | 修复内容                                  |
| ---- | ----------------------------------- | ----------------------------------------- |
| P2-1 | `preview/PreviewManager.ts:291-301` | navigateTo 添加 isDestroyed 检查          |
| P2-2 | `agents/agentLogger.ts:399-407`     | exportToFile 失败时 throw 错误            |
| P2-3 | `core/executor/CLIExecutor.ts:14`   | 移除 cat: ['*'] 通配符                    |
| P2-4 | `core/planner/Replanner.ts:330`     | validateSelector 添加 eslint-disable 注释 |

---

### 2026-04-01 第八轮代码审核修复 (v0.7.4)

#### P1 功能问题修复

| 问题 | 文件                                  | 修复内容                    |
| ---- | ------------------------------------- | --------------------------- |
| P1-1 | `core/planner/TaskPlanner.ts:188-194` | LLM 调用添加 2 分钟超时保护 |

#### P2 代码质量修复

| 问题 | 文件                                | 修复内容                                  |
| ---- | ----------------------------------- | ----------------------------------------- |
| P2-1 | `preview/PreviewManager.ts:291-301` | navigateTo 添加 isDestroyed 检查          |
| P2-2 | `agents/agentLogger.ts:399-407`     | exportToFile 失败时 throw 错误            |
| P2-3 | `core/executor/CLIExecutor.ts:14`   | 移除 cat: ['*'] 通配符                    |
| P2-4 | `core/planner/Replanner.ts:330`     | validateSelector 添加 eslint-disable 注释 |

---

### 2026-04-01 第八轮代码审核修复 - 续 (v0.7.5)

#### P2 代码质量修复

| 问题 | 文件                                 | 修复内容                          |
| ---- | ------------------------------------ | --------------------------------- |
| P2-1 | `agents/mainAgent.ts`                | 使用 generateId() 替代 Date.now() |
| P2-2 | `im/DispatchService.ts:311`          | 扩展随机字符串长度 (8→10)         |
| P2-3 | `im/feishu/FeishuBot.ts:25`          | tokenRefreshBefore 可通过配置设置 |
| P2-4 | `core/executor/ExecutorRouter.ts:64` | 添加 CLI 清理注释                 |

---

### 2026-04-01 第九轮代码审核修复 (v0.7.6)

#### P1 功能问题修复

| 问题 | 文件                        | 修复内容                         |
| ---- | --------------------------- | -------------------------------- |
| P1-1 | `skills/skillRunner.ts:1-2` | 移除未使用的 fs, path 导入       |
| P1-2 | `skills/skillMarket.ts:3`   | 移除未使用的 InstalledSkill 导入 |

#### P2 代码质量修复

| 问题 | 文件                           | 修复内容                                    |
| ---- | ------------------------------ | ------------------------------------------- |
| P2-1 | `ScreencastService.ts:119-121` | captureFrame 添加日志                       |
| P2-2 | `ScreencastService.ts:14`      | 修正 maxHeight 注释                         |
| P2-3 | `history/memoryStore.ts:36`    | oldestKey 添加 undefined 检查               |
| P2-4 | `browser/observer.ts:82`       | captureDiff 使用字段比较替代 JSON.stringify |
| P2-5 | `im/store/sessionStore.ts:37`  | 扩展 session ID 随机字符串长度              |

---

### 2026-04-01 第十轮代码审核

**结果**: 未发现任何新问题 - 代码库质量已达到较高标准

---

## 代码审核汇总

| 轮次     | 发现问题 | 修复数量 | Tag          |
| -------- | -------- | -------- | ------------ |
| 1-6      | 103      | 64       | v0.7.0-0.7.5 |
| 7        | 29       | 18       | v0.7.2-0.7.3 |
| 8        | 10       | 10       | v0.7.4-0.7.5 |
| 9        | 7        | 7        | v0.7.6       |
| 10       | 0        | 0        | -            |
| **总计** | **149**  | **99**   | -            |

---

## GitHub Workflow

### Repository

- **URL**: https://github.com/LeonGaoHaining/opencowork
- **Branch**: main

### Push Changes

```bash
# Add and commit changes
git add .
git commit -m "Description of changes"

# Push to GitHub
git push
```

### Create Pull Request

1. Create a new branch: `git checkout -b feature/your-feature`
2. Make changes and commit
3. Push branch: `git push -u origin feature/your-feature`
4. Open PR on GitHub

### Sync with Remote

```bash
# Fetch latest
git fetch origin

# Pull changes
git pull origin main

# Rebase branch
git rebase origin/main
```

---

## 行为说明

### Screencast 在任务结束后继续发送帧

**现象**: Agent 任务执行完成后（AGENT_END），Screencast 仍在继续发送帧（如 "Sent 30 frames", "Sent 60 frames" 等）

**原因**: 这是正确的预期行为。Screencast 的设计是在整个 Electron 应用运行期间持续捕获屏幕，为用户提供实时预览。任务执行完成仅表示 Agent 工作完成，但用户可能仍在查看预览窗口，因此 Screencast 继续运行。

**触发条件**: 当 PreviewManager 设置为 sidebar 或 detached 模式时，Screencast 会持续运行

**停止条件**:

- 用户关闭预览窗口
- 应用退出
- 调用 ScreencastService.destroy() 方法

---

## Documentation

### Docs Directory

Documentation files are located in: `./docs/`

Key documents:

- `PRD.md` - Product Requirements Document
- `SPEC_v0.4.md` - Technical Specification v0.4
- `USER_GUIDE.md` - User Guide
- `CHANGELOG.md` - Changelog

Last updated: 2026-04-01
