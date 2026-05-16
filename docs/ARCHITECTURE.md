# OpenCowork Architecture

## Overview

OpenCowork is an Electron-based local desktop AI agent runtime. The current implementation combines a renderer UI, a main-process orchestration layer, LangGraph-based agent execution, browser and CLI executors, a skill system, MCP integration on both the client and server side, and an emerging browser / desktop / hybrid computer-use runtime.

This document describes current architecture and technical direction for an open-source project. It is not a production certification, enterprise compliance statement, managed service commitment, or commercial pricing document.

The architecture is currently in transition from an entry-point-driven agent shell to a more unified task-oriented system. The near-term goal is to make `TaskRun`, `TaskResult`, and unified orchestration first-class concepts so that chat, scheduler, IM, history, runs, and templates can share one task lifecycle.

The major product direction now has two layers. First, Hybrid CUA keeps DOM-based browser execution as the default low-cost path while adding visual execution for unstable or highly visual browser tasks. Second, Agent Runtime platformization extracts shared protocol, approval, trace, config, and runtime API boundaries so Electron, Scheduler, IM, MCP, and future clients can reuse the same core task lifecycle.

## Architecture Layers

```text
Clients: Electron UI / Scheduler / IM / MCP / Future CLI
  -> Agent Runtime API / IPC Adapter
  -> Shared Protocol Layer
  -> Runtime Services: lifecycle, approval, trace, config, rules, state
  -> Agent and Execution Layer
  -> Browser / Desktop / Visual / CLI / MCP / Skill Adapters
  -> Persistence, Artifacts, Benchmarks, and External Integrations
```

## Current vs Target

### Current architecture center

The current system is still primarily organized around entry points calling into agent/runtime capabilities, with state and result handling split across renderer stores, IPC handlers, history, scheduler, and IM layers.

### Target convergence direction

The target direction is:

```text
Chat / Scheduler / IM / MCP / Replay / Future CLI
  -> Agent Runtime API
  -> Shared runtime protocol
  -> Task lifecycle, approval, trace, config, and state services
  -> Task Runtime + Agent Brain
  -> Browser / Desktop / Visual / CLI / Skill / MCP Adapters
  -> Run / Result / History / Template / Artifact Persistence
  -> Result-oriented UI, notifications, and release-quality observability
```

This direction is specified across `docs/SPEC_v0.10.x_task-foundation.md`, `docs/SPEC_P4_desktop-computer-use-productization.md`, and `docs/SPEC_P5_agent-runtime-platformization.md`.

## Renderer Layer

The renderer provides the operator-facing product experience:

- chat input and task lifecycle UI,
- result consumption and rerun entry points,
- sidebar result delivery and run inspection,
- session-scoped chat switching and current-run state reset,
- live preview,
- history panel,
- template panel,
- task runs panel,
- skill panel,
- MCP panel,
- settings and control surfaces.

Near-term renderer changes focus on moving result state out of chat messages alone and toward explicit task result state, consistent result sidebars, reusable task surfaces, and overflow-safe long-content rendering.

## Main Process Layer

The main process owns:

- IPC handlers,
- shared agent lifecycle,
- task orchestration entry points,
- session and window management,
- scheduler integration,
- browser executor access,
- MCP client/server coordination.

The current main-process layer is still too centralized. The target architecture thins `ipcHandlers` by turning them into adapters over `AgentRuntimeApi` instead of letting entry handlers directly coordinate agent execution, approval, result handling, and persistence.

## Task Orchestration Layer

The next architecture milestone introduces a dedicated task orchestration layer responsible for:

- creating unified `TaskRun` records,
- marking task source (`chat`, `scheduler`, `im`, `mcp`, `replay`),
- driving runtime execution,
- emitting unified lifecycle events,
- persisting standardized `TaskResult` objects,
- coordinating post-run history and future template creation.

This layer is the foundation for the `v0.11` result-delivery work, the `v0.12` template and multi-entry reuse work, and the `v0.14` Agent Runtime platformization plan.

The latest `v0.14.x` work also depends on keeping post-run analysis scoped to the current task run or active session, so that task results, run detail views, templates, and skill-generation heuristics are not polluted by unrelated turns.

## Agent Layer

The main agent is built around LangGraph ReAct patterns and can combine:

- browser actions,
- CLI actions,
- installed skills,
- MCP-discovered tools,
- memory workflows,
- history-aware follow-up execution.

The agent can preserve thread continuity across follow-up turns while also protecting model context from oversized tool outputs.

Recent `v0.12.3` work also adds a dedicated vision execution path for local images so IM-delivered attachments can be analyzed through multimodal model calls instead of placeholder tool output.

Architecturally, the agent should increasingly act as the system's planning and reasoning brain rather than as the primary home of task lifecycle, result persistence, or cross-entry orchestration logic.

## Runtime Layer

The runtime layer, currently centered on `TaskEngine`, is responsible for:

- task step execution,
- waits, pauses, resumes, and cancellations,
- coordination with browser and CLI executors,
- runtime state transitions during task execution.

Near-term work will keep `TaskEngine` as the execution facade while shifting more system-level orchestration concerns into dedicated runtime services.

Planned decomposition:

- `TaskLifecycleController` for run state transitions,
- `TaskApprovalCoordinator` for unified browser / desktop / CLI / MCP / skill approvals,
- `TaskTraceCollector` for runtime events, artifacts, screenshots, and file-change summaries,
- `TaskStatePersistence` for durable task state,
- `WorkspaceRuleLoader` for `AGENTS.md` and workspace rules,
- `RuntimeConfigService` for shared config defaults, schema, and migration.

## Executors and Tools

### Browser Executor

Supports:

- navigation,
- clicking,
- text input,
- waiting,
- extraction,
- screenshots.

### Hybrid CUA Runtime

The planned Hybrid CUA runtime sits above the existing browser execution stack rather than replacing it outright.

Its intended role is:

- keep DOM-first browser execution for standard, text-centric, and selector-stable tasks,
- introduce a unified visual execution protocol compatible with both `Responses API` and `Chat Completions API`,
- run screenshot-driven browser interaction loops when the task requires visual understanding,
- provide `DOM -> CUA` fallback for selector failures and unstable frontends,
- feed future approval, takeover, templateization, and multi-entry reuse workflows.

Architecturally, this becomes a new runtime capability, not a separate product silo.

The current implementation now includes a first working P0/P1 slice of this direction:

- a `src/visual/` module with unified visual protocol types,
- `Responses API` and `Chat Completions API` visual adapters,
- a browser-backed `ComputerUseRuntime`,
- a `VisualAutomationService` exposed through IPC,
- DOM-first browser execution with visual-first routing for ambiguous selectors and visual fallback for recoverable browser failures,
- an explicit `visual_browser` tool in the main agent so visual execution can be chosen intentionally for complex UI tasks,
- approval interception for high-impact visual action batches,
- renderer-side visual debug UI and approval UI,
- visual turn summaries surfaced in the execution steps panel.

This is still an incremental integration rather than a full system-wide migration. The main agent and browser execution path remain DOM-first, while the visual layer is being introduced as an additive runtime capability.

### CLI Executor

Supports controlled command execution for local workflows and skill-backed scripts.

The P5 runtime direction requires CLI output to become structured rather than string-only. Command results should include stdout, stderr, exit code, duration, timeout state, truncation metadata, and optional log artifacts.

### Vision Executor

`v0.12.3` introduces a dedicated `VisionExecutor` for local image OCR and image analysis:

- IM-delivered files are downloaded locally,
- the agent passes the local path into the vision tool,
- the vision executor converts supported images into data URLs,
- multimodal model calls return OCR or analysis text back to the agent.

This keeps image handling out of the generic text-only LLM abstraction while preserving a minimal integration surface for the main agent.

### Skill System

Skills provide reusable, installable capabilities. The current product already includes patterns such as presentation generation through `ppt-creator`.

Longer term, skills should become clearer building blocks for reusable task templates rather than the sole user-facing reuse primitive.

### MCP Client

OpenCowork can connect to:

- local `stdio` MCP servers,
- remote standard `streamable-http` MCP servers.

Connected MCP tools become available to the main agent.

### MCP Server

OpenCowork can also expose its own selected capabilities as a standard MCP server through `/mcp`, while preserving a legacy `/tools` compatibility path.

## Persistence

OpenCowork currently uses a mix of:

- SQLite-backed task history and checkpoints,
- in-memory runtime state,
- persisted skill data,
- local configuration files.

Near-term persistence work will introduce clearer separation between:

- task run records,
- task results,
- result artifacts,
- historical execution metadata,
- future template definitions.

In practice, the current codebase already persists:

- run records,
- result records,
- history-linked summaries,
- template definitions built from successful runs,
- session-scoped workflow templates built from completed chat runs,
- UI-facing overview metrics composed from history, scheduler, and IM data,
- IM-delivered attachment files stored locally for task execution and follow-up analysis.

The next architecture milestone adds trace and artifact persistence as a first-class concern:

- runtime trace events,
- approval requests and responses,
- structured execution outputs,
- file-change summaries,
- diff artifacts,
- benchmark release-gate metadata.

## Shared Protocol and Runtime API

P5 introduces a shared protocol layer for cross-entry consistency.

Core protocol families:

- `RuntimeCommand` for start, interrupt, resume, cancel, and approval responses,
- `RuntimeEvent` for task lifecycle, tool calls, approval, artifacts, completion, and failure,
- `ApprovalRequest` for human-in-the-loop decisions,
- `ExecutionOutput` for structured tool and adapter results,
- `RuntimeArtifact` for files, screenshots, logs, traces, diffs, and links,
- `RuntimeError` for machine-readable failure handling.

The `AgentRuntimeApi` facade is the boundary that future-proofs clients:

- Electron UI remains the primary client,
- Scheduler, IM, and MCP use the same runtime semantics,
- future CLI or local app-server transport can be added without duplicating task lifecycle logic.

## Design Priorities

The project currently prioritizes:

- real task completion over synthetic demos,
- result delivery over verbose process display,
- desktop-native workflows,
- Browser-first execution quality,
- progressive convergence toward a unified task system,
- pragmatic extensibility,
- stable follow-up continuity,
- safe handling of large tool outputs,
- session-correct task and result surfaces.

## Near-Term Technical Focus

- introduce unified task run / result models,
- introduce a dedicated task orchestration layer,
- make history and UI more result-oriented,
- align scheduler and IM with shared task lifecycle semantics,
- keep IM file delivery and image analysis on the shared run/result path,
- improve text extraction quality for browser tasks,
- reduce unnecessary screenshot usage,
- improve desktop opener command handling,
- continue hardening MCP tool selection and execution,
- introduce the P0 Hybrid CUA foundation with a unified visual protocol,
- deepen Hybrid execution recovery, approval, and takeover flows,
- productize successful browser runs into reusable templates and multi-entry workflows,
- keep template execution UI short while preserving full prompts for runtime execution,
- prepare provider-aware routing and platform-level capability abstraction.

## Related Specs

- `docs/SPEC_v0.10.x_task-foundation.md`
- `docs/SPEC_P0_hybrid-cua-foundation.md`
- `docs/SPEC_P1_hybrid-recovery-and-approval.md`
- `docs/SPEC_P2_templateization-and-multi-entry.md`
- `docs/SPEC_P3_platformization-and-ecosystem.md`
- `docs/PRD.md`
