# Changelog

All notable changes to OpenCowork are documented in this file.

## Unreleased

### Focus

The next work stream builds on `v0.12.3` with more result-driven desktop workflows, stronger IM delivery quality, and broader product hardening.

### Highlights

- Extended the IM workflow so Feishu can receive files from users and send generated result files back.
- Added real image analysis and OCR execution instead of placeholder vision responses.
- Clarified local-only configuration handling so sensitive IM config files stay out of Git history.

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
