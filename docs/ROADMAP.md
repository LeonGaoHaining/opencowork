# OpenCowork Roadmap

## Product Direction

OpenCowork is evolving from an internal high-velocity agent shell into a browser-first local AI agent runtime that emphasizes task completion, result delivery, and repeatable automation experiments, while keeping MCP interoperability and open-source extensibility.

This roadmap is directional. It is not a commitment to hosted SaaS availability, production certification, enterprise compliance, commercial pricing, managed support, or guaranteed delivery dates.

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
- English and Chinese UI,
- skill uninstall from persisted local folders,
- session-level successful workflow template creation,
- automatic Electron native module rebuilds after install,
- compact footer controls for long localized labels.

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
- P4 desktop smoke suite and mixed benchmark coverage for desktop notes, browser handoff, browser reference capture, and desktop approval recovery.
- Added a browser-first desktop finish benchmark to better cover browser-to-desktop workflow handoff.
- Added a desktop focus recovery benchmark to cover window-switch and refocus recovery behavior.
- Added a desktop file dialog recovery benchmark to cover failed file picker flows.
- Added a desktop upload recovery benchmark to cover failed transfer and upload flows.
- Added a browser-to-desktop-to-browser download/rename/upload benchmark to cover a realistic mixed file workflow.
- Workflow pack catalog now shows outcomes, install feedback, installed-state sorting, and installed-only filtering.
- Result/history/task-run surfaces now normalize `executionTarget` and `actionContract` so desktop metadata persists cleanly across reloads.
- Skill uninstall now removes the actual installed skill folder instead of only updating UI state.
- Successful completed chat runs in the active session can now be saved as a reusable workflow template.
- Template reruns now keep full prompts for execution while showing short titles in chat, task status, and logs.
- New session creation now immediately switches the active chat surface without requiring a second click.

## Near-Term Roadmap

### P0: Hybrid CUA foundation

- Establish a unified visual execution protocol centered on `VisualModelAdapter`.
- Support both `Responses API` and `Chat Completions API` visual adapters.
- Introduce browser-only `ComputerUseRuntime` on top of the existing Playwright / CDP stack.
- Add the minimum viable Hybrid router: `DOM-first`, `CUA fallback`.
- Add minimum approval handling for high-impact browser actions.
- Add visual execution traces and baseline metrics.

### P1: Hybrid execution depth

- Strengthen Browser-first task completion and visual recovery.
- Add `Visual Recovery Mode` for selector failures and unstable frontends.
- Unify preview, approval, and takeover into a single execution chain.
- Add adapter-aware benchmark tasks and evaluation reporting.
- Improve continuation and restore semantics for hybrid browser runs.

### P2: Productized reuse and multi-entry execution

- Turn successful hybrid runs into reusable templates.
- Support parameterized reruns across chat, scheduler, IM, and MCP.
- Strengthen result delivery as a first-class product surface.
- Make history more result-centric and reuse-oriented.
- Expand artifact delivery: files, links, screenshots, structured outputs.
- Keep long template prompts and result payloads from breaking chat, status, and sidebar layouts.
- Continue improving tests for browser, task, history, and template flows.

### P3: Platformization and ecosystem expansion

- Introduce provider-aware routing across visual backends.
- Build a capability registry for model and visual-runtime abstraction.
- Add official workflow packs for browser-heavy work and make them installable as reusable templates.
- Validate desktop-grade computer use expansion from the existing browser-first runtime.
- Expand Templates, Skills, and MCP into a clearer open ecosystem.
- Improve contributor ergonomics, documentation, and release quality.

### P4: Desktop computer use productization

- Introduce a unified browser / desktop / hybrid execution abstraction.
- Add at least one isolated desktop harness path for formal runtime support.
- Productize desktop approval, recovery, and benchmark workflows.
- Support browser-and-desktop mixed workflows as first-class automation targets.
- Establish the desktop computer use contract for future industry packs and ecosystem extensions.

### P5: Agent runtime platformization

- Extract a shared runtime protocol for task events, commands, approvals, outputs, errors, and artifacts.
- Introduce an `AgentRuntimeApi` facade so Electron, Scheduler, IM, MCP, and future CLI/Web clients reuse the same runtime.
- Unify approval policy across browser, desktop, visual, CLI, MCP, and skill execution.
- Productize Plan Mode as a read-only planning path before execution.
- Add task trace, file-change summaries, diff artifacts, and structured execution output for inspection-oriented observability.
- Centralize runtime configuration, workspace rules, and `AGENTS.md` loading.
- Continue decomposing `TaskEngine` into focused runtime services and coordinators.

## Strategic Themes

### 1. Browser-first task delivery

The product should keep improving at finishing browser-heavy work and returning usable outputs rather than only showing an execution trace.

### 2. Unified task system

Chat, scheduler, IM, replay, and future MCP-triggered work should converge on a shared task model and lifecycle.

### 3. MCP-native extensibility

OpenCowork should be able to both consume and expose MCP tools cleanly.

### 4. Practical desktop automation

The product should solve real work: browsing, searching, collecting, summarizing, generating assets, and orchestrating repeatable local tasks.

### 5. Skills as reusable product surface

Skills should become a compelling layer for community extension and lightweight automation packaging.

### 6. Open-source credibility

The project should be documented clearly, easy to evaluate, and explicit about current limitations for builders, tinkerers, and product teams.

### 7. Runtime platformization

OpenCowork should become a reusable local Agent Runtime, not only an Electron app. UI, IM, scheduler, MCP, and future clients should share protocol, approval, trace, configuration, and task lifecycle semantics.

## Key Specs

- `docs/SPEC_v0.10.x_task-foundation.md` — task foundation and architectural convergence
- `docs/SPEC_P0_hybrid-cua-foundation.md` — hybrid CUA foundation and unified visual protocol
- `docs/SPEC_P1_hybrid-recovery-and-approval.md` — hybrid recovery, approval, and takeover depth
- `docs/SPEC_P2_templateization-and-multi-entry.md` — templateization and multi-entry hybrid reuse
- `docs/SPEC_P3_platformization-and-ecosystem.md` — platformization, provider abstraction, and ecosystem expansion
- `docs/SPEC_P4_desktop-computer-use-productization.md` — desktop computer use productization
- `docs/SPEC_P5_agent-runtime-platformization.md` — agent runtime protocol, approval, trace, config, and multi-client reuse
- `docs/PRD.md` — product direction and P0-P5 / PRD 7.0 planning
