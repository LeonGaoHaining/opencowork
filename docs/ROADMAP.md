# OpenCowork Roadmap

## Product Direction

OpenCowork is evolving from an internal high-velocity agent shell into a Browser-first AI work system that emphasizes task completion, result delivery, and repeatable automation, while keeping strong MCP interoperability and open-source extensibility.

## Current Stage

### Available now

- desktop AI task execution,
- browser automation,
- skill installation and execution,
- task history and recovery groundwork,
- unified task runs and persisted task results,
- reusable templates with parameterized reruns,
- Feishu integration,
- MCP client support,
- MCP server mode,
- English and Chinese UI.

### Current transition

The current codebase is entering an architectural convergence phase:

- unify task models across chat, scheduler, IM, and history,
- introduce a result-oriented task pipeline,
- reduce direct entry-point to agent coupling,
- prepare template-ready task abstractions for future automation reuse,
- harden the result sidebar, run scoping, and reusable workflow quality.

### Recently completed

- unified `TaskRun` / `TaskResult` / `TaskArtifact` / `TaskTemplate` runtime model,
- result persistence and result delivery in the main workflow,
- result-oriented history records with outcome filters and rerun links,
- editable template panel with parameterized template runs and validation,
- template creation from successful runs and history records,
- scheduler template execution with stored result metadata,
- IM template commands, recent-task result summaries, and run links,
- bidirectional IM file delivery and attachment-aware task creation,
- first-stage task orchestration convergence across chat, scheduler, IM, and replay.
- result delivery moved into the sidebar execution area,
- overview metrics panel restored and guarded against partial payloads,
- broader i18n coverage for template, runs, result, history, and IM task surfaces,
- regression coverage for template validation, result persistence, run-to-template conversion, IM run links, result-first history rendering, IM attachments, and vision execution.

## Near-Term Roadmap

### v0.10.x stabilization

- Introduce a unified task foundation (`TaskRun`, `TaskResult`, `TaskArtifact`).
- Introduce a unified task orchestration entry for the main chat flow.
- Start shifting history from step-oriented records to result-oriented records.
- Align scheduler and IM with shared run/result semantics.
- Extend orchestration semantics to pause/resume/cancel/status handling.
- Reduce redundant screenshot usage in text-centric tasks.
- Improve extraction quality for noisy pages.
- Improve handling of desktop opener commands such as `xdg-open`.
- Continue reducing MCP tool misfires on first attempt.

### v0.11.x workflow depth

- Stronger Browser-first task completion and recovery.
- Result delivery as a first-class product surface.
- Result-centric history and clearer rerun flows.
- Better task restore and continuation flows.
- Cleaner exposure control for MCP server tools.

### v0.12.x ecosystem readiness

- Task templates and parameterized reruns.
- Shared task model across chat, scheduler, IM, replay, and MCP.
- Result-centric history and template-centric reuse flows.
- Result delivery in the sidebar and stronger run inspection UX.
- Bidirectional IM file workflows with local attachment context.
- Real image OCR and image analysis for IM-driven tasks.
- More productized skills and clearer skill contracts.
- Better docs and example configurations.
- Improved tests for browser, task, history, and template flows.
- More polished release packaging.
- Stronger open-source contributor ergonomics.

## Strategic Themes

### 1. Browser-first task delivery

The product should become best-in-class at finishing browser-heavy work and returning usable outputs rather than only showing an execution trace.

### 2. Unified task system

Chat, scheduler, IM, replay, and future MCP-triggered work should converge on a shared task model and lifecycle.

### 3. MCP-native extensibility

OpenCowork should be able to both consume and expose MCP tools cleanly.

### 4. Practical desktop automation

The product should solve real work: browsing, searching, collecting, summarizing, generating assets, and orchestrating repeatable local tasks.

### 5. Skills as reusable product surface

Skills should become a compelling layer for community extension and lightweight automation packaging.

### 6. Open-source credibility

The project should feel reliable, well-documented, and easy to evaluate for builders, tinkerers, and product teams.

## Key Specs

- `docs/SPEC_v0.10.x_task-foundation.md` — task foundation and architectural convergence
- `docs/PRD.md` — product direction and v0.11 / v0.12 planning
