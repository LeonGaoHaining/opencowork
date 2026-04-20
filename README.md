<h1 align="center">OpenCowork</h1>

<p align="center"><strong>An open-source desktop AI work system for browser automation, reusable task runs, templates, MCP-native tooling, and real local execution.</strong></p>

<p align="center">
  <a href="https://github.com/LeonGaoHaining/opencowork/stargazers"><img src="https://img.shields.io/github/stars/LeonGaoHaining/opencowork?style=social" alt="stars"></a>
  <a href="https://github.com/LeonGaoHaining/opencowork/releases"><img src="https://img.shields.io/github/v/release/LeonGaoHaining/opencowork?include_prereleases" alt="release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/LeonGaoHaining/opencowork" alt="license"></a>
  <a href="https://github.com/LeonGaoHaining/opencowork/issues"><img src="https://img.shields.io/github/issues/LeonGaoHaining/opencowork" alt="issues"></a>
  <a href="https://opencowork.me"><img src="https://img.shields.io/badge/Website-opencowork.me-brightgreen" alt="website"></a>
</p>

## Why OpenCowork

OpenCowork is built for people who want an agent that does more than chat. It can open websites, operate a headed browser, call CLI tools, run reusable skills, persist task history, and now connect to or expose standard MCP servers.

It is designed for fast iteration on real desktop workflows: research, operations, internal tools, demos, browser automation, and repeatable task execution.

Compared with many "chat-first" agent demos, OpenCowork is moving toward a result-first workflow:

- every serious task should produce a reusable run record,
- successful work should be reviewable as a result,
- useful work should become a template,
- repeated work should be schedulable or triggerable from IM.

## Current Product Direction

The current work stream is converging around a result-centric task model:

- task runs are recorded as reusable `TaskRun` records,
- completed work persists into `TaskResult`,
- history is shifting toward outcomes, artifacts, and rerun links,
- templates can be created from successful runs and executed with parameters,
- scheduler and IM surfaces now reuse the same task/result semantics.

## What's New in v0.12.3

- Feishu now supports bidirectional file workflows: users can send files and images in, and OpenCowork can send generated result files and images back out.
- Images received through IM can now be analyzed with real multimodal vision and OCR instead of placeholder responses.
- Attachment-only IM messages can automatically create a task using the received file as local context.
- Result artifacts continue to flow through the shared task-result model across chat, history, scheduler, and IM.
- Added regression tests for IM attachment delivery and the new vision executor.

## Highlights in v0.10.10

- Standard MCP client support for remote `streamable-http` endpoints such as LangChain Docs MCP.
- Standard MCP server mode with a `/mcp` endpoint, while keeping legacy `/tools` compatibility.
- A clearer MCP UI split into `Clients` and `Server Mode`.
- Better follow-up continuity across agent turns using thread reuse.
- Safer long-running conversations by preventing screenshot payloads from blowing up model context.
- Improved browser search flows with `pressEnter` support for input actions.
- Stronger memory, task history, and restore foundations for real multi-step work.

## Core Capabilities

| Capability         | What it enables                                               |
| ------------------ | ------------------------------------------------------------- |
| Desktop Agent      | Multi-step task execution through a ReAct-style agent         |
| Browser Automation | Navigate, click, type, extract, wait, and capture screenshots |
| Skills             | Install and run reusable capabilities like `ppt-creator`      |
| MCP Client         | Connect external MCP tools and use them inside the agent      |
| MCP Server         | Expose OpenCowork capabilities to other MCP clients           |
| Task History       | Persist task results, steps, and recovery state               |
| Task Templates     | Save successful work as reusable, parameterized task flows    |
| IM File Workflow   | Send tasks and files through Feishu and receive result files  |
| Vision Analysis    | OCR and multimodal understanding for local images             |
| Human-in-the-loop  | Pause, resume, interrupt, and take over tasks                 |
| International UI   | English-first UI with Chinese support                         |

## Who This Is For

OpenCowork is a good fit if you are:

- building a desktop AI copilot with real browser and local execution,
- evaluating MCP-native agent UX beyond CLI-only demos,
- automating recurring research, operations, or reporting workflows,
- experimenting with reusable agent templates and result-centric history,
- contributing to an open-source desktop agent stack that is still moving fast.

## Quick Start

### Requirements

- Node.js 18+
- npm 9+
- Python 3.8+ for selected skills
- A valid LLM API configuration in `config/llm.json`

### Install

```bash
git clone https://github.com/LeonGaoHaining/opencowork.git
cd opencowork
npm install
```

### Configure your model

Create `config/llm.json`:

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

For image analysis through IM, use a model deployment that supports image input on `chat/completions`.

### Local config safety

- Keep `config/` local to your machine.
- `config/` is git-ignored and should never be committed.
- Feishu credentials such as `config/feishu.json` must not be pushed to GitHub.

### Run the desktop app

```bash
npm run electron:dev
```

## Example Prompts

```text
Open Baidu, search for a company, and summarize what it does.
Create a company overview PPT from the information on the page.
Connect an MCP tool and use it to fetch LangChain docs examples.
Open the generated PPT file.
Turn the successful task into a reusable template and schedule it weekly.
```

## MCP Support

OpenCowork now supports both sides of MCP:

- As an MCP client, it can connect to standard remote MCP servers.
- As an MCP server, it can expose tools through a standard `/mcp` endpoint.

Examples:

- Connect to `https://docs.langchain.com/mcp` from the MCP client panel.
- Enable server mode and expose selected OpenCowork tools to external clients.

## Documentation

- `CHANGELOG.md` — release history
- `USER_GUIDE.md` — product usage guide
- `docs/ARCHITECTURE.md` — architecture overview
- `docs/ROADMAP.md` — product direction
- `CONTRIBUTING.md` — contribution workflow
- `SECURITY.md` — security reporting policy

## Development

```bash
# Main desktop development flow
npm run electron:dev

# Build all targets
npm run build

# Test
npm run test:run

# Lint and format
npm run lint
npm run format
```

## Open Source Status

OpenCowork is moving from an internal fast-iteration agent into a stronger open-source developer product. The current release is best suited for builders who want:

- a desktop automation foundation,
- an MCP-native local agent shell,
- a skill-based extensibility layer,
- a result-centric task system with reusable templates,
- and a project that is actively shipping core agent infrastructure.

## Current Release Notes

`v0.12.3` is the current recommended tag.

- `v0.12.0` introduced the task-result-template workflow convergence.
- `v0.12.1` fixed the missing overview panel files from that release.
- `v0.12.2` adds follow-up stabilization for result delivery, i18n, run scoping, overview safety, and reusable workflow UX.
- `v0.12.3` adds bidirectional Feishu file workflows and real image analysis for IM-driven tasks.

## Community

- Issues: https://github.com/LeonGaoHaining/opencowork/issues
- Discussions: https://github.com/LeonGaoHaining/opencowork/discussions
- Website: https://opencowork.me

## License

Apache-2.0. See `LICENSE`.
