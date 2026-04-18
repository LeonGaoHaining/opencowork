# Changelog

All notable changes to OpenCowork are documented in this file.

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
