# Changelog

All notable changes to OpenCowork are documented in this file.

## v0.14.7 - 2026-05-12

### Release focus

Make startup and versioning safe for cross-platform clones by replacing the Unix-only source cleanup command and restoring the tracked settings manager module that was previously hidden by an over-broad ignore rule.

### Highlights

- Replaced the `find`-based `clean:src` script with a Node implementation so `electron:dev` works on Windows, macOS, and Linux.
- Narrowed the ignore rule for `config/` so `src/config/settings.ts` can be tracked in Git and cloned normally.
- Bumped the package and renderer version markers to `0.14.7` for the release tag.

### Verification

- `node ./scripts/clean-src.mjs`

### Notes

- `src/config/settings.ts` stores local UI/runtime settings only; it does not contain API keys or tokens.

## v0.14.6 - 2026-05-10

### Release focus

Improve runtime stability for local-first desktop AI automation by tightening task failure semantics, child-process timeout behavior, MCP stdio cleanup, visual automation cleanup, history persistence, and renderer task-event isolation.

### Highlights

- Stopped unrecoverable task execution failures from continuing through later plan nodes and overwriting failed state with completed state.
- Updated CLI action timeouts so timed-out commands terminate their child process and resolve only once.
- Fixed pending history writes so records added during an active SQLite flush are preserved and flushed in a follow-up batch.
- Hardened MCP stdio connection failure, timeout, disconnect, and pending request cleanup paths.
- Added desktop harness launch/shutdown command timeouts to prevent visual desktop lifecycle operations from hanging indefinitely.
- Ensured visual adapter sessions are destroyed even if computer cleanup fails.
- Filtered renderer task events by the current run or handle to reduce stale event state corruption.
- Awaited Ask User IPC responses and bounded direct session message loads.

### Open-source marketing and usage notes

- This release is framed as a stability and reliability update for evaluators and contributors; it does not claim enterprise production certification, hosted SaaS availability, or commercial pricing.
- Local configuration and credentials remain private by default. Do not publish `config/llm.json`, IM credentials, tokens, cookies, local databases, or task artifacts.
- The recommended evaluation path remains a dedicated desktop, VM, or isolated user account for browser, MCP, CLI, and IM automation.

### Verification

- `npm run build`

### Known test status

- `npm run test:run` currently has existing UI/i18n text assertion failures in `IMConfigPanel`, `SkillPanel`, and `TemplatePanel`. These failures are not part of the `v0.14.6` stability patch, but they remain visible in the full suite and should be addressed separately.

## v0.14.4 - 2026-05-09

### Release focus

Stabilize Feishu follow-up handling, preserve user authorization context, and make the browser visual/computer-use execution path more reliable.

### Highlights

- Preserved authorization clarifications in Feishu conversation history so follow-up retries keep the user's explicit approval intent.
- Updated the main agent execution contract to treat explicit authorization for public data collection as executable work instead of an automatic refusal.
- Added DOM-first routing for structured extraction tasks, with fallback to hybrid visual execution only when DOM parsing fails.
- Implemented the Responses computer-use protocol closed loop with `computer_call` parsing and `computer_call_output` continuation handling.
- Added regression coverage for Feishu authorization context, DOM-first routing, and Responses computer-call continuation.

### Verification

- `npm run build:main`
- `npx vitest run src/im/feishuPrompt.test.ts src/im/__tests__/DispatchService.test.ts src/core/task/__tests__/taskRouting.test.ts src/visual/runtime/__tests__/ComputerUseRuntime.test.ts src/visual/__tests__/VisualAutomationService.test.ts`

## v0.14.3 - 2026-05-08

### Release focus

Improve Feishu follow-up handling so repeated messages in the same conversation preserve recent context when forwarded to the agent.

### Highlights

- Added bounded Feishu conversation history to task prompts so follow-up questions keep the recent chat context.
- Recorded Feishu task outcomes back into the same conversation history to improve continuity across related requests.

### Verification

- `npm run test:run -- src/im/DispatchService.spec.ts`
- `npm run build:main`

## v0.14.2 - 2026-05-04

### Release focus

Ship the current workflow-template, session, and UI hardening slice while keeping the existing open-source commercial direction intact.

### Highlights

- Fixed installed skill uninstall so the backend deletes the real persisted `skill.path`, with compatibility for legacy skill folder locations.
- Added session-level successful workflow template creation from completed chat runs in the current session, excluding failed, cancelled, paused, or confirmation-waiting attempts.
- Improved template execution UX by keeping the full prompt for runtime execution while showing short template titles in chat, task status, run titles, and main-process logs.
- Hardened result delivery, chat messages, task status, and active step rendering against oversized template text and long structured output.
- Fixed new-session creation so clicking the new session button immediately switches the chat UI, task state, current run, result panel, and active steps to the new session.
- Updated public documentation and release notes for the current `v0.14.2` release line.

### Verification

- `npm run build`

### Notes

- Commercial direction content in `README.md` and this changelog remains intentionally preserved: OpenCowork stays open source while productizing high-value local AI automation services around the runtime.

## v0.12.10 - 2026-05-02

### Release focus

Refresh the public open-source surface for the current desktop AI work system direction and align the release line with Agent Runtime platformization planning.

### Highlights

- Repositioned the README around desktop AI work, browser automation, MCP-native tooling, reusable task runs, Hybrid CUA, and runtime platformization.
- Added PRD 7.0 planning for a shared Agent Runtime with clearer protocol, approval, trace, config, and runtime service boundaries.
- Added `docs/SPEC_P5_agent-runtime-platformization.md` covering shared protocol, runtime API, unified approval, structured outputs, Plan Mode, workspace rules, trace/diff, config, and `TaskEngine` decomposition.
- Updated `docs/ROADMAP.md` with P5 Agent Runtime platformization and a new runtime platformization strategic theme.
- Refreshed the user guide, contributing guide, security policy, issue templates, and pull request template for a more polished open-source contributor experience.
- Bumped package metadata to `0.12.10` after the existing `v0.12.9` release tag.

### Notes

- This release is documentation and release-surface focused. It does not introduce a runtime migration yet.
- `gh` authentication is required to publish the GitHub release from the local workspace.

## v0.12.7 - 2026-04-30

### Release focus

Close the current desktop-computer-use slice by tightening VM as the primary smoke path, surfacing execution-target context in approvals, and refreshing the P4 desktop smoke suite.

### Highlights

- Added desktop approval audit context to the visual approval dialog so execution-target metadata is visible during approval.
- Added a VM-focused runtime smoke test that verifies desktop-capable requests include the correct execution target and allowed actions.
- Added a VM-specific desktop smoke benchmark and included it in the P4 desktop smoke suite.
- Updated the P4 delivery checklist to match the current desktop approval, runtime, and benchmark state.

## Unreleased

### Focus

The next work stream builds on `v0.12.4` with more result-driven desktop workflows, stronger IM delivery quality, and broader product hardening.

### Business positioning

- Refined the README positioning around OpenCowork as a local-first desktop AI Agent Runtime for executable, reusable, and auditable business workflows.
- Clarified that the product is not a generic chatbot or traditional RPA recorder; it is intended to turn successful local AI task runs into templates, scheduled work, IM-driven workflows, and private automation packages.
- Added a stronger target-customer description for builders, researchers, product teams, semi-technical operators, and enterprise design partners evaluating local AI automation.

### Commercial scenarios

- Added typical commercialization-oriented scenarios including market and sales research, operations file processing, MCP-connected internal workflows, browser back-office automation, scheduled knowledge work, and agent runtime experiments.
- Connected core runtime capabilities to business outputs such as research briefs, lead lists, cleaned spreadsheets, OCR results, structured reports, workflow templates, audit traces, and reusable artifacts.

### Go-to-market notes

- Documented the recommended commercial direction: open-source distribution, design partner pilots, scenario-based workflow delivery, private deployment guidance, annual support, reusable template packs, training, and later lightweight team subscriptions.
- Explicitly avoided presenting commercial pricing or customer claims as shipped product features; the update is a product narrative and release-surface improvement rather than a runtime change.

### Highlights

- Extended the IM workflow so Feishu can receive files from users and send generated result files back.
- Added real image analysis and OCR execution instead of placeholder vision responses.
- Clarified local-only configuration handling so sensitive IM config files stay out of Git history.
- Reworked the product planning docs around a new `P0-P3` Hybrid CUA roadmap instead of the older `v0.11/v0.12` wording.
- Added dedicated specs for Hybrid CUA foundation, recovery and approval depth, templateized multi-entry reuse, and platformization.
- Updated architecture and roadmap documentation to reflect the new Browser-first Hybrid CUA direction.
- Added a first working `src/visual/` runtime skeleton with unified protocol types, model adapters, browser execution adapters, and a minimal computer-use loop.
- Added browser-side Hybrid routing so ambiguous browser actions can go visual-first and selector failures can fall back from DOM execution into the visual runtime.
- Added approval interception for high-impact visual action batches, plus a renderer approval dialog with approve-and-continue, takeover, and cancel flows.
- Added a renderer-side visual debug entry point and surfaced visual turns in the execution steps panel.
- Added persisted visual trace summaries to the result panel, run details view, and history view so Hybrid CUA behavior can be reviewed after task completion.
- Added an explicit `visual_browser` tool to the main agent so visual browser execution can be selected proactively for complex UI tasks, not only as a fallback path.
- Added unit coverage for Hybrid routing, computer-use approval behavior, visual approve continuation, visual-turn-to-step mapping, history visual-trace filtering, result visual-trace rendering, and run-details visual-trace rendering.

## v0.12.5 - 2026-04-23

### Release focus

Turn the new Hybrid CUA direction from a planning-only track into a working Browser-first feature slice with explicit visual execution, approval-aware continuation, and persisted visual trace review.

### Highlights

- Added a first working `src/visual/` runtime foundation with unified visual protocol types, model adapters, and a browser-backed computer-use loop.
- Added DOM-first browser routing with visual-first handling for ambiguous selectors and visual fallback for recoverable browser failures.
- Added a dedicated `visual_browser` tool to the main agent so it can proactively choose visual browser execution for complex UI tasks.
- Added approval interception for high-impact visual actions, plus approve-and-continue and takeover flows in the renderer.
- Added a visual debug entry point in the control bar and surfaced visual turns in execution steps, result delivery, run details, and history.
- Added regression coverage for the visual runtime, visual approval continuation, visual trace rendering, and persisted visual trace filtering.

### Notes

- `v0.12.5` is now the recommended tag for the current Hybrid CUA feature slice.

## v0.12.4 - 2026-04-21

### Release focus

Fix Feishu IM reply routing so each task always returns to the originating chat, whether it starts in a private chat or a group thread.

### Fixes

- Fixed task completion and failure replies so private-chat tasks stay in private chat and group-chat tasks reply to the original group thread.
- Fixed progress notifications so they follow the original task conversation instead of falling back to a private IM notification channel.
- Added regression coverage for private-chat and group-chat reply routing.

### Security and config notes

- Runtime Feishu credentials remain local-only under `config/`, which is git-ignored and must not be published to GitHub.

### Notes

- `v0.12.4` is the recommended release tag for the current IM reply-routing fix.

## v0.12.3 - 2026-04-21

### Release focus

Turn the current IM workflow into a practical file-driven channel by enabling bidirectional Feishu file transfer, image understanding, and updated public documentation for the new release line.

### Highlights

- Added bidirectional Feishu file handling so IM users can send images and files into OpenCowork and receive generated result files back.
- Added attachment-aware IM task creation, including default task generation for attachment-only messages.
- Added real vision execution for local images through multimodal model calls, covering both OCR and general image analysis.
- Added regression coverage for IM attachment task creation, IM artifact return, and the new `VisionExecutor`.
- Updated release docs, architecture notes, roadmap messaging, and user guidance for the current IM and vision workflow.

### Fixes

- Fixed Feishu inbound message handling so `image` and `file` messages are no longer ignored.
- Fixed IM result delivery so file and image artifacts can be sent back through Feishu instead of being reduced to summary text only.
- Fixed the previous placeholder-only vision path that prevented the agent from analyzing images received through IM.
- Fixed IM reply targeting so group replies use the correct message target while private chats continue using the conversation target.

### Security and config notes

- Runtime IM credentials remain local-only under `config/`, which is git-ignored and must not be published to GitHub.
- Sample documentation continues to use placeholder API keys only.

### Notes

- `v0.12.3` is now the recommended release tag for the current result-centric, IM-enabled workflow line.

## v0.12.2 - 2026-04-20

### Release focus

Stabilize the new task-result-template workflow after `v0.12.1`, improve result delivery UX, strengthen task-run scoping, and make the public docs and release messaging consistent for open-source adoption.

### Highlights

- Scoped post-run extraction to the current task run so result synthesis and action counting no longer inherit prior thread actions.
- Moved result delivery into the sidebar execution area for clearer result review during and after task execution.
- Expanded translation coverage for Templates, Runs, result actions, history actions, and IM task cards.
- Hardened overview metrics handling with safe defaults to prevent renderer crashes from partial payloads.
- Improved CLI handling for large PPT JSON payloads by preferring file-based command normalization.
- Updated public docs, roadmap, architecture, and user guide messaging for the current open-source product direction.

### Fixes

- Fixed result extraction and skill-generation heuristics being polluted by older turns in the same thread.
- Fixed `OverviewPanel` crashes caused by incomplete metrics payloads.
- Reduced incorrect artifact generation for plain text results.
- Fixed `Result Delivery` placement so results live in the sidebar instead of only in the chat stream.
- Fixed missing i18n coverage for `Templates`, `Runs`, `View Run`, and related result workflow actions.

### Notes

- `v0.12.2` is now the recommended release tag for the current task-result-template workflow line.

## v0.12.1 - 2026-04-20

### Release focus

Make the new task-result-template workflow usable as a public open-source release by fixing the broken overview flow, strengthening result surfaces, and improving reusable workflow clarity.

### Highlights

- Unified `TaskRun`, `TaskResult`, and template-driven workflow surfaces across chat, history, scheduler, and IM.
- Added persistent result handling and consistent run links so successful work can be reviewed and reused.
- Added parameterized template execution and run-to-template conversion.
- Added result-oriented history filters and stronger run inspection UX.
- Added regression tests covering template validation, result persistence, run-to-template generation, IM run links, and result-first history rendering.

### Fixes

- Added the missing `OverviewPanel` and `overviewStore` files required by the renderer overview flow.
- Guarded overview metrics against partial payloads to prevent renderer crashes.
- Moved result delivery into the sidebar execution area for a clearer operator workflow.
- Expanded translation coverage for Templates, Runs, result actions, and related task panels.
- Reduced incorrect artifact generation for plain text results.
- Bumped the application version after the `v0.12.0` tag to keep the published tag history consistent.

### Notes

- `v0.12.0` introduced the task/result/template convergence work.
- `v0.12.1` is the recommended stable tag from this line because it restores the missing overview files and includes the follow-up stabilization fixes.

## v0.10.10 - 2026-04-18

### Release focus

This release turns OpenCowork into a much stronger MCP-native desktop agent while improving continuity across long multi-step tasks.

### Highlights

- Added standard MCP client support for remote `streamable-http` endpoints.
- Added standard MCP server mode at `/mcp` while keeping legacy `/tools` compatibility.
- Shipped a redesigned MCP panel with separate `Clients` and `Server Mode` tabs.
- Improved follow-up task continuity by reusing thread context across turns.
- Added `list_mcp_tools` and MCP catalog awareness so the agent can discover connected MCP tools.
- Fixed MCP tool argument forwarding so direct top-level parameters now work correctly.
- Prevented screenshot payloads from exploding model context in long-running threads.
- Improved browser input flows with `pressEnter` support.
- Refined i18n coverage and MCP UI wording.

### MCP and Agent Improvements

- Connected OpenCowork to standard remote MCP servers such as LangChain Docs MCP.
- Exposed OpenCowork capabilities through a standard MCP server implementation.
- Added explicit MCP transport support with backward-compatible config normalization.
- Reduced repeated MCP tool reload churn with tool-signature deduplication.
- Improved agent awareness of MCP tools through prompt and tool-catalog updates.

### UX Improvements

- Split MCP management into clearer client and server workflows.
- Improved follow-up task handling so users can continue work in the same task thread.
- Tightened model-visible tool result summaries to keep longer sessions usable.

### Notes

- Some browser understanding tasks may still overuse screenshots compared with extraction-first flows.
- Desktop opener commands such as `xdg-open` may succeed on the host system even when the command is reported as timed out. This will be improved in a future patch.

## v0.10.9 - 2026-04-16

### Release focus

Internationalization support across the desktop UI.

### Highlights

- Added English and Chinese UI support.
- Added language switching and persisted language preference.
- Expanded translation coverage across major renderer components.

## v0.10.8 - 2026-04-14

- Version maintenance and packaging updates.

## v0.10.7 - 2026-04-14

- Packaging and metadata fixes.

## v0.10.6 - 2026-04-14

### Release focus

Browser stability for multi-task sessions.

### Highlights

- Improved headed browser resilience.
- Better handling of browser lifecycle interruptions.

## v0.10.4 - 2026-04-14

- Browser viewport adaptation updates.

## v0.10.3 - 2026-04-11

- Better browser preview synchronization.

## v0.10.2 - 2026-04-10

- Browser preview v2.0 improvements.

## v0.10.1 - 2026-04-09

- IM configuration panel and connection-status improvements.
