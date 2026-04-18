# OpenCowork Architecture

## Overview

OpenCowork is an Electron-based desktop agent that combines a renderer UI, a main-process orchestration layer, LangGraph-based agent execution, browser and CLI executors, a skill system, and MCP integration on both the client and server side.

## Architecture Layers

```text
Renderer UI (React)
  -> IPC Layer (Electron main process)
  -> Agent and Runtime Layer
  -> Executors and Tools
  -> Persistence and External Integrations
```

## Renderer Layer

The renderer provides the operator-facing product experience:

- chat input and task lifecycle UI,
- live preview,
- history panel,
- skill panel,
- MCP panel,
- settings and control surfaces.

## Main Process Layer

The main process owns:

- IPC handlers,
- shared agent lifecycle,
- session and window management,
- scheduler integration,
- browser executor access,
- MCP client/server coordination.

## Agent Layer

The main agent is built around LangGraph ReAct patterns and can combine:

- browser actions,
- CLI actions,
- installed skills,
- MCP-discovered tools,
- memory workflows,
- history-aware follow-up execution.

The agent can now preserve thread continuity across follow-up turns while also protecting model context from oversized tool outputs.

## Executors and Tools

### Browser Executor

Supports:

- navigation,
- clicking,
- text input,
- waiting,
- extraction,
- screenshots.

### CLI Executor

Supports controlled command execution for local workflows and skill-backed scripts.

### Skill System

Skills provide reusable, installable capabilities. The current product already includes patterns such as presentation generation through `ppt-creator`.

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

## Design Priorities

The project currently prioritizes:

- real task completion over synthetic demos,
- desktop-native workflows,
- pragmatic extensibility,
- stable follow-up continuity,
- safe handling of large tool outputs.

## Near-Term Technical Focus

- improve text extraction quality for browser tasks,
- reduce unnecessary screenshot usage,
- improve desktop opener command handling,
- continue hardening MCP tool selection and execution.
