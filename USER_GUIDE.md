# OpenCowork User Guide

This guide covers the current public workflow for using OpenCowork as a desktop AI agent.

## What OpenCowork Does Best

OpenCowork is designed for tasks that require a mix of:

- browser automation,
- local desktop execution,
- structured agent reasoning,
- reusable skills,
- and MCP-native tool integration.

Common examples include:

- research and summarization,
- browser-based operations,
- task follow-ups over multiple turns,
- company and product discovery,
- document and presentation generation.

## Getting Started

### 1. Configure your model

Create `config/llm.json` with your preferred provider and credentials.

### 2. Launch the app

```bash
npm run electron:dev
```

### 3. Start with a concrete task

Examples:

```text
Open Baidu and search for a company.
Summarize what this company does.
Create a professional PPT from the findings.
Use the connected LangChain MCP to fetch an example.
```

## Main Product Areas

### Chat and Task Execution

Use the main input box to give the agent a task.

OpenCowork can:

- plan a task,
- operate the browser,
- execute CLI commands,
- call installed skills,
- and continue work across follow-up prompts when the task stays in the same thread.

### Live Preview

The preview area shows the browser and agent activity in real time so you can observe what the agent is doing and decide when to intervene.

### History

Task history stores prior executions, steps, and outcomes so you can review what happened and recover context when needed.

### Skills

Skills are reusable capability modules stored under `~/.opencowork/skills/`.

Current workflows include:

- listing installed skills,
- opening the skill panel,
- generating or previewing skills,
- running specialized capabilities such as `ppt-creator`.

## MCP Client Guide

Open the MCP panel and use the `Clients` tab to connect external MCP servers.

Supported today:

- local `stdio` servers,
- remote standard `streamable-http` endpoints.

Example remote endpoint:

```text
https://docs.langchain.com/mcp
```

Once connected, the agent can discover and call these MCP tools during task execution.

## MCP Server Mode Guide

Open the MCP panel and use the `Server Mode` tab to expose OpenCowork capabilities to external MCP clients.

Current server mode supports:

- a standard `/mcp` endpoint,
- a legacy `/tools` compatibility layer,
- configurable authentication,
- selected internal tools exposed as MCP tools.

Use server mode when you want another MCP-capable app or agent to call OpenCowork.

## Internationalization

The desktop UI is English-first and supports Chinese. Language choice is persistent.

## Recommended Prompt Style

Best results come from prompts that specify:

- the site or system to use,
- the target outcome,
- what format you want back,
- and whether the agent should continue with a follow-up action.

Examples:

```text
Open Baidu, search for X, and summarize what the company does.
Then turn the findings into a five-slide company intro deck.
Use LangChain docs MCP and give me a minimal Python example.
```

## Known Behavioral Notes

- Desktop opener commands such as `xdg-open` may launch successfully even if the current executor times them out.
- Some text-centric browser tasks may still overuse screenshots before falling back to extraction.
- MCP tool choice is improving, but some tools may still require a retry when the model first under-specifies parameters.

## Troubleshooting

### The agent cannot use an MCP tool

- Confirm the MCP client connection is active.
- Open the MCP panel and verify tools are listed.
- Ask the agent what MCP tools are available.

### A follow-up task loses context

- Make sure the task is being continued in the same active thread.
- Avoid manually resetting the current task state between turns.

### A browser task extracts noisy content

- Ask the agent to target a narrower page region instead of `body`.
- Ask for extraction from the result container, article container, or main content area.

## More Docs

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`
