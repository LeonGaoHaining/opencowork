# OpenCowork User Guide

This guide explains how to use OpenCowork as a desktop AI work system for browser automation, local execution, reusable task runs, templates, skills, IM workflows, and MCP tools.

## What OpenCowork Does Best

OpenCowork is strongest when a task requires more than one model response:

- opening websites and operating a headed browser,
- collecting and summarizing information,
- generating files or structured results,
- calling local tools and reusable skills,
- using MCP-connected services,
- receiving tasks from IM and returning result files,
- saving successful work as reusable templates.

## Getting Started

### 1. Install Dependencies

```bash
git clone https://github.com/LeonGaoHaining/opencowork.git
cd opencowork
npm install
```

OpenCowork requires Node.js 20 or 22 LTS. During `npm install`, native modules such as `better-sqlite3` are rebuilt for Electron automatically. If Electron reports a native module version mismatch, run `npm run rebuild:native` and launch again.

### 2. Configure Your Model

Create `config/llm.json` with your provider, model, and credentials.

```json
{
  "provider": "openai",
  "model": "gpt-5.4-mini",
  "apiKey": "your-api-key",
  "baseUrl": "https://api.openai.com/v1",
  "timeout": 60000,
  "maxRetries": 3
}
```

For image analysis and OCR through IM attachments, use a model deployment that supports image input.

### 3. Keep Local Config Private

- Keep all files under `config/` local to your device.
- `config/` is git-ignored and should not be committed or published.
- `config/feishu.json` contains live IM credentials and must never be pushed to GitHub.

### 4. Launch the App

```bash
npm run electron:dev
```

## Main Product Areas

### Chat and Task Execution

Use the main input box to give the agent a concrete goal. OpenCowork can plan the task, operate the browser, run CLI actions, call installed skills, use MCP tools, and continue across follow-up prompts when the task stays in the same active thread.

Good prompt examples:

```text
Open Baidu and search for a company, then summarize what it does.
Create a five-slide company intro deck from the research findings.
Use LangChain Docs MCP and give me a minimal Python example.
Analyze this uploaded product screenshot and return a concise report.
```

### Live Preview and Human Oversight

The preview area shows browser and agent activity in real time. You can observe execution, approve high-impact actions, pause or resume work, interrupt active tasks, or take over when manual control is safer.

### Result Delivery

When a task completes, OpenCowork surfaces the result in the sidebar so you can review the final outcome without scrolling through the full chat.

Result delivery can include:

- final summary,
- structured data,
- generated files,
- screenshots,
- artifact links,
- run details,
- template and scheduler actions.

The result panel also supports saving the successful workflow for the current session. This path only uses completed chat runs from the active session, so failed, cancelled, paused, or confirmation-waiting attempts are not folded into the saved template.

Long summaries, structured data, artifact lists, and visual traces are constrained inside scrollable result sections so one large result does not break the main layout.

### Sessions

Use the session panel to create, select, rename, and delete chat sessions. Creating a new session immediately switches the chat area to that session, clears the current task/result surface, and keeps future prompts attached to the new session without requiring a second click on the session row.

### History and Runs

Task history stores prior executions, results, steps, and outcomes. The current product direction is result-centric: summaries, artifacts, run links, and template links are more important than raw step logs alone.

Use history and runs to:

- inspect what happened,
- find successful work,
- rerun useful tasks,
- save a run as a template,
- debug failures and recovery behavior.

### Templates

Templates turn successful work into reusable automation.

You can:

- save a successful run as a template,
- save the successful runs from the active session as a reusable workflow template,
- edit template metadata and parameters,
- run a template again with new inputs,
- add a template to the scheduler,
- trigger template-like workflows from IM.

When running a saved template, OpenCowork keeps the full template prompt for execution but shows a short title in chat, task status, and run records. This prevents long workflow prompts from overflowing the chat UI while preserving the real execution input.

### Skills

Skills are reusable capability modules stored under `~/.opencowork/skills/`.

Current skill workflows include:

- listing installed skills,
- browsing available skills,
- previewing skill metadata,
- installing or updating skills,
- uninstalling installed skills from their actual persisted folder,
- running specialized capabilities such as presentation generation.

### MCP Client

Open the MCP panel and use the `Clients` tab to connect external MCP servers.

Supported endpoint types:

- local `stdio` servers,
- remote standard `streamable-http` endpoints.

Once connected, the agent can discover and call MCP tools during task execution.

### MCP Server Mode

OpenCowork can expose selected capabilities to external MCP clients through a standard `/mcp` endpoint while preserving a legacy `/tools` compatibility path.

Use server mode when another MCP-capable app or agent should call OpenCowork.

### IM and Feishu File Workflows

OpenCowork supports file-driven IM workflows through Feishu:

- send a text task plus an attached file or image,
- send only a file and let OpenCowork create a default task,
- receive generated result files and images back through Feishu,
- ask follow-up questions about a just-uploaded image.

Current behavior:

- incoming Feishu attachments are downloaded to the local app data directory,
- the agent receives the local file path as task context,
- image attachments can use OCR or general image analysis through the vision path,
- result file artifacts can be uploaded back to Feishu after task completion.

## Agent Runtime Observability

OpenCowork now includes the first reusable local Agent Runtime baseline:

- shared protocol for task events, approvals, outputs, artifacts, and errors,
- one runtime API for Electron, Scheduler, IM, MCP, and future clients,
- unified approval policy across browser, desktop, visual, CLI, MCP, and skills,
- Plan Mode for read-only analysis before execution,
- trace and diff artifacts for audit-grade observability.

In the task runs panel, run details can include:

- runtime trace status, mode, event counts, and recent events,
- trace artifacts such as full CLI logs and workspace diff files,
- loaded workspace rules from `AGENTS.md`,
- changed file summaries for completed or failed tasks.

Runtime defaults are read from `config/runtime.json` when present. If the file is missing or invalid, OpenCowork falls back to safe defaults and continues running.

See `docs/SPEC_P5_agent-runtime-platformization.md` for the detailed plan.

## Recommended Prompt Style

Best results come from prompts that specify:

- the site, file, or tool to use,
- the target outcome,
- the output format,
- whether follow-up actions are allowed,
- whether the task should be saved as a reusable workflow.

Example:

```text
Open the target website, collect the pricing table, summarize changes in markdown, save the result, and offer to turn this into a weekly template.
```

## Known Behavioral Notes

- Desktop and hybrid computer-use support is still productizing and should be treated as an active development area.
- Some text-centric browser tasks may still overuse screenshots before falling back to extraction.
- MCP tool choice is improving, but some tools may still require a retry when the model first under-specifies parameters.
- Long-running desktop opener commands can succeed on the host even when the current executor reports a timeout.

## Troubleshooting

### The agent cannot use an MCP tool

- Confirm the MCP client connection is active.
- Open the MCP panel and verify tools are listed.
- Ask the agent what MCP tools are available.

### A follow-up task loses context

- Make sure the task is continued in the same active thread.
- Avoid manually resetting the current task state between turns.

### An IM image task says the model cannot analyze the image

- Check that your `config/llm.json` model deployment supports image input.
- Confirm the uploaded file is a supported image type such as `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, or `.bmp`.
- Retry with a smaller or clearer image if the model response is incomplete.

### A browser task extracts noisy content

- Ask the agent to target a narrower page region.
- Prefer article, table, result container, or main content selectors over `body`.

## More Docs

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/PRD.md`
- `docs/RELEASE_v0.14.2.md`
- `CHANGELOG.md`
