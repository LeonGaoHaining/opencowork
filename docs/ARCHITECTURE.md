# OpenCowork Architecture

## Overview

OpenCowork is an Electron-based desktop AI work system. The current implementation combines a renderer UI, a main-process orchestration layer, LangGraph-based agent execution, browser and CLI executors, a skill system, and MCP integration on both the client and server side.

The architecture is currently in transition from an entry-point-driven agent shell to a more unified task-oriented system. The near-term goal is to make `TaskRun`, `TaskResult`, and unified orchestration first-class concepts so that chat, scheduler, IM, history, runs, and templates can share one task lifecycle.

The next major product direction also introduces a Hybrid CUA layer for browser-heavy work. In this direction, OpenCowork keeps `webfetch` and DOM-based browser execution as the default low-cost path, while adding a visual execution path that can inspect screenshots, propose UI actions, and act as a fallback for unstable or highly visual browser tasks. This direction is organized in the product docs as `P0-P3` planning rather than a single versioned browser rewrite.

## Architecture Layers

```text
Renderer UI (React)
  -> IPC Layer (Electron main process)
  -> Task Orchestration Layer
  -> Agent and Runtime Layer
  -> Executors and Tools
  -> Persistence and External Integrations
```

## Current vs Target

### Current architecture center

The current system is still primarily organized around entry points calling into agent/runtime capabilities, with state and result handling split across renderer stores, IPC handlers, history, scheduler, and IM layers.

### Target convergence direction

The target direction is:

```text
Chat / Scheduler / IM / MCP / Replay
  -> Task Orchestrator
  -> Task Runtime + Agent Brain
  -> Browser / CLI / Skill / MCP Adapters
  -> Run / Result / History / Template Persistence
  -> Result-oriented UI and notifications
```

This direction is specified in `docs/SPEC_v0.10.x_task-foundation.md`.

## Renderer Layer

The renderer provides the operator-facing product experience:

- chat input and task lifecycle UI,
- result consumption and rerun entry points,
- sidebar result delivery and run inspection,
- live preview,
- history panel,
- template panel,
- task runs panel,
- skill panel,
- MCP panel,
- settings and control surfaces.

Near-term renderer changes focus on moving result state out of chat messages alone and toward explicit task result state, consistent result sidebars, and reusable task surfaces.

## Main Process Layer

The main process owns:

- IPC handlers,
- shared agent lifecycle,
- task orchestration entry points,
- session and window management,
- scheduler integration,
- browser executor access,
- MCP client/server coordination.

The current main-process layer is still too centralized. A near-term architecture goal is to thin `ipcHandlers` by introducing a dedicated task orchestration layer instead of letting entry handlers directly coordinate agent execution and result handling.

## Task Orchestration Layer

The next architecture milestone introduces a dedicated task orchestration layer responsible for:

- creating unified `TaskRun` records,
- marking task source (`chat`, `scheduler`, `im`, `mcp`, `replay`),
- driving runtime execution,
- emitting unified lifecycle events,
- persisting standardized `TaskResult` objects,
- coordinating post-run history and future template creation.

This layer is the foundation for the `v0.11` result-delivery work and the `v0.12` template and multi-entry reuse work.

The latest `v0.12.x` work also depends on keeping post-run analysis scoped to the current task run, so that task results, run detail views, and skill-generation heuristics are not polluted by previous turns in the same thread.

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

Near-term work will keep `TaskEngine` as the execution core while shifting more system-level orchestration concerns out of entry points and into a dedicated task layer.

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
- UI-facing overview metrics composed from history, scheduler, and IM data,
- IM-delivered attachment files stored locally for task execution and follow-up analysis.

## Design Priorities

The project currently prioritizes:

- real task completion over synthetic demos,
- result delivery over verbose process display,
- desktop-native workflows,
- Browser-first execution quality,
- progressive convergence toward a unified task system,
- pragmatic extensibility,
- stable follow-up continuity,
- safe handling of large tool outputs.

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
- prepare provider-aware routing and platform-level capability abstraction.

## Related Specs

- `docs/SPEC_v0.10.x_task-foundation.md`
- `docs/SPEC_P0_hybrid-cua-foundation.md`
- `docs/SPEC_P1_hybrid-recovery-and-approval.md`
- `docs/SPEC_P2_templateization-and-multi-entry.md`
- `docs/SPEC_P3_platformization-and-ecosystem.md`
- `docs/PRD.md`
