# OpenCowork v0.10.10 Release Notes

## Release Theme

OpenCowork is now a stronger MCP-native desktop agent for real task execution.

This release focuses on three areas:

- better MCP interoperability,
- better multi-turn continuity,
- and better reliability for long-running desktop tasks.

## What Shipped

### Standard MCP client support

OpenCowork can now connect to standard remote MCP servers over `streamable-http`, including endpoints such as LangChain Docs MCP.

### Standard MCP server mode

OpenCowork can now expose selected capabilities over a standard `/mcp` endpoint while preserving compatibility with the legacy `/tools` interface.

### Better MCP UX

The MCP panel is now split into:

- `Clients`
- `Server Mode`

This makes it much clearer whether you are connecting to external MCP tools or exposing OpenCowork as an MCP server.

### Better follow-up continuity

The desktop app now preserves thread continuity across follow-up tasks more reliably, making multi-turn workflows such as search -> summarize -> generate assets much smoother.

### Safer long-running context

Large tool outputs, especially screenshot payloads, are now summarized before they reach model-visible history. This makes longer task threads much less likely to fail due to context overflow.

### Better browser task execution

Browser input now supports `pressEnter`, improving common search and form workflows.

## Example Workflows Now Working Better

- Search for a company and summarize what it does.
- Turn the findings into a presentation using `ppt-creator`.
- Connect LangChain Docs MCP and fetch examples from official docs.
- Continue the same task thread over multiple follow-up instructions.

## Known Limitations

- Some text-centric browser tasks may still overuse screenshots before converging on extraction.
- Desktop opener commands such as `xdg-open` may succeed on the host while still being reported as timed out.

## Why This Release Matters

v0.10.10 makes OpenCowork feel much more like a usable open-source agent shell instead of a collection of disconnected features. It can now:

- consume MCP tools,
- expose MCP tools,
- stay alive across follow-up turns,
- and complete realistic multi-step desktop tasks.
