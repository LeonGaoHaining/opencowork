# OpenCowork User Guide

This guide covers the current public workflow for using OpenCowork as a desktop AI work system.

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

If you want image analysis and OCR through IM attachments, the configured model deployment must support image input.

### Local config safety

- Keep all files under `config/` local to your device.
- `config/` is git-ignored and should not be committed or published.
- In particular, `config/feishu.json` contains live IM credentials and must never be pushed to GitHub.

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

### Result Delivery

When a task completes, the result summary is shown in the right sidebar together with execution context.

This makes it easier to:

- review the final outcome without scrolling through the full chat,
- inspect artifacts and structured output,
- jump to the full run record,
- save the task as a template,
- or add it directly to the scheduler.

### History

Task history stores prior executions, results, steps, and outcomes so you can review what happened and recover context when needed.

History is now more result-centric:

- summary and artifacts are shown before raw step traces,
- run links let you jump back to the full execution record,
- template links let you reuse successful tasks faster.

### Task Results and Templates

When a task completes successfully, OpenCowork saves a structured result object.

You can then:

- open the result panel to review the summary and artifacts,
- save the run as a reusable template,
- run that template again with parameters,
- or add it to the scheduler for repeat execution.

This is the main workflow for the current v0.12 task-model direction.

### Skills

Skills are reusable capability modules stored under `~/.opencowork/skills/`.

Current workflows include:

- listing installed skills,
- opening the skill panel,
- generating or previewing skills,
- running specialized capabilities such as `ppt-creator`.

### Templates and Runs

OpenCowork now exposes reusable task flows more explicitly:

- `Templates` stores reusable task definitions,
- `Runs` stores recent task executions,
- both surfaces support English and Chinese UI labels,
- successful runs can become templates,
- and templates can be rerun with parameters or added to the scheduler.

### IM and Feishu File Workflows

OpenCowork now supports file-driven IM workflows through Feishu:

- send a text task plus an attached file or image,
- send only a file and let OpenCowork create a default task automatically,
- receive generated result files and images back through Feishu,
- ask follow-up questions about a just-uploaded image.

Current behavior:

- incoming Feishu attachments are downloaded to the local app data directory,
- the agent receives the local file path as task context,
- image attachments can use OCR or general image analysis through the `vision` tool,
- result file artifacts are uploaded back to Feishu after task completion.

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

Recent task-centric surfaces with language support include:

- result delivery,
- template panel,
- runs panel,
- history actions,
- IM task cards.

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

### The overview panel opens but shows no useful data

- Make sure the desktop app has writable access to the history database and config directory.
- If there are simply no recent tasks, the overview panel may show zeroed metrics rather than charts.
- `v0.12.1` adds safer fallback handling for partial metrics payloads.

### An IM image task says the model cannot analyze the image

- Check that your `config/llm.json` model deployment supports image input.
- Confirm the uploaded file is a supported image type such as `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, or `.bmp`.
- Retry with a smaller or clearer image if the model response is incomplete.

### A browser task extracts noisy content

- Ask the agent to target a narrower page region instead of `body`.
- Ask for extraction from the result container, article container, or main content area.

## More Docs

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`
