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

## Documentation

### Docs Directory

Documentation files are located in: `./docs/`

Key documents:

- `PRD.md` - Product Requirements Document
- `SPEC_v0.4.md` - Technical Specification v0.4
- `USER_GUIDE.md` - User Guide
- `CHANGELOG.md` - Changelog

Last updated: 2026-03-30
