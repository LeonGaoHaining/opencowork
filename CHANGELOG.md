# OpenCowork Changelog

| Version | Date       | Status   |
| ------- | ---------- | -------- |
| v0.10.6 | 2026-04-14 | Released |
| v0.10.5 | 2026-04-14 | Released |
| v0.10.4 | 2026-04-14 | Released |
| v0.10.3 | 2026-04-11 | Released |
| v0.10.2 | 2026-04-10 | Released |
| v0.10.1 | 2026-04-09 | Released |
| v0.9.0  | 2026-04-07 | Released |
| v0.8.9  | 2026-04-06 | Released |
| v0.7.6  | 2026-04-01 | Released |
| v0.4.0  | 2026-03-29 | Planned  |
| v0.3.0  | 2026-03-29 | Released |
| v0.2.3  | 2026-03-29 | Released |

---

## v0.10.6 (2026-04-14) - Browser Stability Fix 🐛

### Release Goal

Fix headed browser closing unexpectedly after first task completion, enabling continuous multi-task browser operations.

### Core Changes

| Module          | Change Type | Description                                      |
| --------------- | ----------- | ------------------------------------------------ |
| BrowserExecutor | Bug Fix     | Add page.isClosed() check, auto-restart on close |

### Features

- ✅ Auto-restart browser when closed unexpectedly
- ✅ Support continuous multi-task browser operations
- ✅ Improved reliability for long-running tasks

---

## v0.10.4 (2026-04-14) - Browser Viewport Adaptation 🪟

### Release Goal

Make the headed browser behave like a normal Chrome window with natural content adaptation during window dragging.

### Core Changes

| Module              | Change Type | Description                                        |
| ------------------- | ----------- | -------------------------------------------------- |
| BrowserExecutor     | Refactor    | Set viewport: null for OS window size following    |
| launchHeadedBrowser | Refactor    | Remove --start-maximized and fixed defaultViewport |

### Features

- ✅ Natural content adaptation during window dragging
- ✅ Restore Chrome native window behavior
- ✅ Remove fixed viewport constraints

---

## v0.10.3 (2026-04-11) - CDP Connection Enhancement

### Release Goal

Enhance Agent browser synchronization with webview preview.

### Core Changes

| Module         | Change Type | Description                          |
| -------------- | ----------- | ------------------------------------ |
| mainAgent.ts   | Enhancement | Sync URL + Title to webview          |
| ipcHandlers.ts | Enhancement | browser:syncWebview supports title   |
| App.tsx        | Enhancement | Receive title and update address bar |

### Features

- ✅ Sync URL + Title to webview after Agent operations
- ✅ Address bar displays current page title
- ✅ User interaction event listening

---

## v0.10.2 (2026-04-10) - Browser Preview v2.0

### Release Goal

Upgrade preview area to real browser with toolbar and Agent operation sync.

### Core Changes

| Module          | Change Type | Description                                |
| --------------- | ----------- | ------------------------------------------ |
| PreviewManager  | Refactor    | BrowserWindow replaces BrowserView         |
| App.tsx Sidebar | New Feature | webview embedded in sidebar                |
| Toolbar         | New Feature | Address bar, nav buttons, status indicator |
| BrowserExecutor | New Feature | CDP connection methods                     |
| mainAgent.ts    | New Feature | Sync webview after Agent operations        |
| IPC Handlers    | New Feature | browser:webviewNavigate                    |

### Features

- ✅ Sidebar displays real browser (webview)
- ✅ Toolbar: ←→↻× buttons, address bar
- ✅ URL sync to webview after Agent operations
- ✅ Three preview modes: sidebar/collapsible/detached
- ✅ Enable webviewTag

### Bug Fixes

- PreviewManager default mode set to sidebar
- App.tsx sidebar missing toolbar
- preview:setMode IPC channel

---

## v0.10.1 (2026-04-09) - IMConfigPanel + ConnectionStatus

### Release Goal

Visual IM platform configuration without manual config file editing.

### Core Changes

| Module                  | Change Type | Description                 |
| ----------------------- | ----------- | --------------------------- |
| IMConfigPanel           | New Feature | IM platform config UI       |
| IMButton                | New Feature | ControlBar status indicator |
| ConnectionStatusManager | New Feature | Real-time connection status |
| IPC Handlers            | New Feature | im:load/save/test/status    |

### Bug Fixes

- TaskEngine.cancel() call error
- IPC return value auto-wrapping issue
- Config file path resolution issue
- Agent not initialized issue

### Improvements

- Agent pre-initialization
- IPC layer NO_WRAP_CHANNELS mechanism

---

## v0.9.0 (2026-04-07) - IMConfigPanel Initial

## v0.4.0 (Planned) - LangChain/LangGraph Refactoring

### Release Goal

Full migration to LangChain/LangGraph TypeScript version, implementing standardized Agent execution flow.

### Core Changes

| Module        | v0.3 Implementation     | v0.4 LangGraph Implementation |
| ------------- | ----------------------- | ----------------------------- |
| State Mgmt    | Map<string, TaskHandle> | StateSchema + Checkpointer    |
| Execution     | PlanExecutor linear     | StateGraph Nodes/Edges        |
| Planner       | TaskPlanner LLM call    | Agent Node + Tools            |
| Recovery      | RecoveryEngine manual   | Built-in Durable Execution    |
| Memory        | ShortTermMemory Map     | Memory Store                  |
| Validation    | Verifier manual         | Graph State Validation        |
| Observability | console.log manual      | LangSmith integration         |

### Implementation Plan

| Phase | Weeks      | Tasks                                         |
| ----- | ---------- | --------------------------------------------- |
| 1     | Week 1-2   | LangChain/LangGraph intro, StateSchema design |
| 2     | Week 3-4   | StateGraph refactor, basic Nodes impl         |
| 3     | Week 5-6   | Browser/CLI Tools wrapping                    |
| 4     | Week 7-8   | Checkpointer persistence                      |
| 5     | Week 9-10  | Memory Store integration                      |
| 6     | Week 11-12 | Vision Tool wrapping                          |
| 7     | Week 13-14 | LangSmith integration                         |
| 8     | Week 15-16 | Testing and optimization                      |

### Expected Metrics

| Metric        | v0.3   | v0.4 Target |
| ------------- | ------ | ----------- |
| Task success  | 85-95% | 90-98%      |
| Code reuse    | -      | +40%        |
| Recovery      | Manual | Built-in    |
| Observability | Manual | LangSmith   |

### Milestones

- **Week 4**: Core Graph runnable
- **Week 8**: Task persistence recovery
- **Week 12**: Vision Tool complete
- **Week 16**: v0.4 released

---

## v0.3.0 (2026-03-29) - Industrial Browser Agent Architecture

### Release Goal

Implement industrial-grade Browser Agent architecture with 85-95% task success rate.

### New Features

1. **UIGraph Semantic Layer** - Transform DOM to semantic element graph, LLM sees semantic IDs not raw selectors
2. **Observer** - Page observer class, capture UIGraph on failure
3. **Verifier** - Post-execution verification layer
4. **RecoveryEngine** - Independent LLM-driven recovery decision system
5. **ShortTermMemory** - Record success/failure trajectories for learning
6. **Anti-crawler Documentation** - Document existing anti-crawler implementation and known weaknesses

### Core Architecture

```
Observe → Decide → Act → Verify → Recovery → Memory
         ↑                              ↓
         └────────  Triggered on failure ←────────┘
```

### New Files

| File                             | Purpose                      |
| -------------------------------- | ---------------------------- |
| `src/types/uiElement.ts`         | UI element and UIGraph types |
| `src/types/verifier.ts`          | Verifier type definitions    |
| `src/browser/uiGraph.ts`         | UIGraph semantic builder     |
| `src/browser/observer.ts`        | Page observer class          |
| `src/executor/verifier.ts`       | Verification layer           |
| `src/recovery/recoveryEngine.ts` | Recovery engine              |
| `src/memory/shortTermMemory.ts`  | Short-term memory            |

### Expected Metrics

| Metric            | v0.2 | v0.3 Target |
| ----------------- | ---- | ----------- |
| Task success rate | ~65% | 85-95%      |
| Click accuracy    | ~80% | >95%        |
| Step latency      | 2-5s | 1-3s        |
| Recovery rate     | ~50% | >80%        |

---

## v0.2.3 (2026-03-29)

### New Features

1. **Element scroll into view** - Add `scrollIntoViewIfNeeded()` before click and input operations

2. **PressEnter parameter support** - `browser:input` Action supports `pressEnter` parameter

### Bug Fixes

1. **Comment input failure** - Elements below page not found
2. **Enter key timing issue** - Wait 100ms after input before pressing Enter
3. **Selector parsing issue** - Comma-separated selectors not split correctly
4. **Task queue conflict** - Add `isTaskRunning()` check
5. **Selector application error** - Only modify failed node, not all nodes
6. **IPC duplicate registration** - `ask:user:response` handler
7. **Page structure enhancement** - Extract DOM structure and 30 link boundingBox coordinates
8. **Login popup detection** - Detect during task execution, not startup

### Improvements

1. **Preview speed** - fps 24, quality 20, maxWidth 800
2. **Browser height auto-fit** - Remove maxHeight limit
3. **LLM reasoning mode** - Enable `reasoning_effort: 'medium'`
4. **Selector generation** - System prompt enhancement
5. **Session persistence** - SessionManager + sessionStore + SessionPanel

### Dependencies

- playwright-extra: ^4.3.6
- playwright-stealth: ^0.0.1
- zustand: ^4.5.7

---

## v0.2.2 (2026-03-28)

### New Features

1. **SessionPanel component** - UI for session history
2. **Page structure extraction** - getPageStructure() extracts links and container info

### Bug Fixes

1. **Preview height limit** - Remove maxHeight limit
2. **Enter double send** - Remove Enter fallback on click failure

---

## v0.2.1 (2026-03-28)

### Bug Fixes

1. **Preview slow** - Optimize ScreencastService fps and quality
2. **Login popup misdetection** - Optimize detection logic

---

## v0.2.0 (2026-03-28)

### New Features

1. **ask:user complete implementation** - AskUserExecutor + IPC full flow
2. **Replanner dynamic replanning** - LLM decision retry strategy, up to 3 retries
3. **Selector stability improvement** - Multi-strategy selectors + fallbacks
4. **ScreencastService** - Real-time screenshot preview

---

## v0.1.0 (2026-03-27)

### First Release (MVP)

- Electron + React + Vite project
- TaskPlanner task planning
- PlanExecutor plan execution
- TaskEngine task engine
- BrowserExecutor browser automation
- CLIExecutor command execution
- ChatUI / ControlBar / TakeoverModal components

---

_Documentation created: 2026-03-29_
