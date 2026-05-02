<h1 align="center">OpenCowork</h1>

<p align="center"><strong>Open-source desktop AI work system for browser automation, desktop workflows, MCP-native tools, reusable task runs, and result-first agent execution.</strong></p>

<p align="center">
  <a href="https://github.com/LeonGaoHaining/opencowork/stargazers"><img src="https://img.shields.io/github/stars/LeonGaoHaining/opencowork?style=social" alt="stars"></a>
  <a href="https://github.com/LeonGaoHaining/opencowork/releases"><img src="https://img.shields.io/github/v/release/LeonGaoHaining/opencowork?include_prereleases" alt="release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/LeonGaoHaining/opencowork" alt="license"></a>
  <a href="https://github.com/LeonGaoHaining/opencowork/issues"><img src="https://img.shields.io/github/issues/LeonGaoHaining/opencowork" alt="issues"></a>
  <a href="https://opencowork.me"><img src="https://img.shields.io/badge/Website-opencowork.me-brightgreen" alt="website"></a>
</p>

## Why OpenCowork

OpenCowork is for builders who want an AI agent that can do real work on a local desktop, not only answer chat messages. It combines a headed browser, local execution, reusable skills, MCP integrations, task history, templates, and human-in-the-loop approval into one desktop-native agent system.

The product direction is result-first:

- finish useful tasks, not just stream reasoning,
- preserve task runs as inspectable records,
- turn successful runs into reusable templates,
- connect local desktop execution with IM, Scheduler, Skills, and MCP,
- make browser and desktop automation observable, recoverable, and repeatable.

## What You Can Build

OpenCowork is a practical foundation for:

- research and browser automation agents,
- internal operations copilots,
- result-centric task history and reusable automation,
- MCP-native local agent workflows,
- Feishu-driven task intake and file delivery,
- desktop computer-use experiments with approval and benchmark loops,
- open-source agent runtime research around protocol, trace, and multi-client reuse.

## Current Release: v0.12.10

`v0.12.10` refreshes the public open-source surface and aligns the documentation with the current runtime direction.

Highlights:

- updated open-source positioning around desktop AI work, MCP, reusable runs, and runtime platformization,
- refreshed roadmap, user guide, contributor guidance, security policy, and GitHub issue/PR templates,
- aligned package metadata with the new release line after the existing `v0.12.9` tag.

Recent product milestones:

- `v0.12.9`: skill panel toolbar wrapping and release polish.
- `v0.12.8`: Feishu delivery and GPT-5 fixes.
- `v0.12.7`: desktop smoke and approval updates.
- `v0.12.6`: P3 platformization and workflow packs.
- `v0.12.5`: first working Hybrid CUA browser runtime with visual execution and persisted visual trace review.

## Core Capabilities

| Capability | What it enables |
| --- | --- |
| Desktop Agent | Multi-step local task execution through an agent runtime |
| Browser Automation | Navigate, click, type, extract, wait, and capture screenshots |
| Hybrid CUA | DOM-first browser automation with visual execution fallback and approval flows |
| Desktop Workflows | Early browser / desktop / hybrid computer-use productization path |
| Task Runs | Persist task execution state, results, artifacts, and reusable run context |
| Templates | Save successful work as parameterized, repeatable workflows |
| Scheduler | Run reusable tasks on a schedule |
| Feishu / IM | Submit tasks and files remotely, receive progress and result files |
| Skills | Install and run reusable capability modules |
| MCP Client | Connect external MCP tools and use them inside the agent |
| MCP Server | Expose OpenCowork capabilities to external MCP clients |
| Human Oversight | Pause, resume, interrupt, approve, cancel, and take over tasks |
| i18n | English-first UI with Chinese support |

## Architecture Direction

OpenCowork is moving from a single Electron app with many entry points toward a reusable local Agent Runtime.

```text
Electron UI / Scheduler / IM / MCP / Future CLI
  -> Agent Runtime API
  -> Shared Protocol Layer
  -> Runtime Services: lifecycle, approval, trace, config, rules, state
  -> Execution Adapters: browser, desktop, visual, CLI, MCP, skill
  -> Result, history, template, benchmark, and artifact surfaces
```

This direction is documented in:

- `docs/PRD.md` section `21. PRD 7.0`,
- `docs/SPEC_P5_agent-runtime-platformization.md`,
- `docs/ROADMAP.md` under `P5: Agent runtime platformization`.

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

### Configure Your Model

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

Keep `config/` local. It is git-ignored and must not be committed.

### Run the Desktop App

```bash
npm run electron:dev
```

### Build and Test

```bash
npm run build
npm run test:run
npm run lint
```

## Example Prompts

```text
Open a company website, summarize what it does, and save a reusable research summary.
Search for competitor pricing changes and turn the result into a structured report.
Use a connected MCP server to fetch documentation examples and explain them.
Analyze this Feishu-uploaded image and send the result file back to the chat.
Turn the successful workflow into a template and schedule it weekly.
```

## MCP Support

OpenCowork supports both sides of MCP:

- as an MCP client, it connects to local `stdio` servers and remote `streamable-http` endpoints,
- as an MCP server, it exposes selected OpenCowork capabilities through a standard `/mcp` endpoint.

Try connecting a remote MCP endpoint from the MCP panel, then ask the agent what tools are available.

## Documentation

- `USER_GUIDE.md` — practical usage guide
- `docs/ARCHITECTURE.md` — architecture overview
- `docs/ROADMAP.md` — near-term and strategic roadmap
- `docs/PRD.md` — product requirements and version planning
- `docs/SPEC_P5_agent-runtime-platformization.md` — next runtime platformization spec
- `CHANGELOG.md` — release history
- `CONTRIBUTING.md` — contribution workflow
- `SECURITY.md` — vulnerability reporting policy

## Open Source Status

OpenCowork is actively evolving. The current release line is best suited for builders, researchers, and product teams who want to evaluate or contribute to a local desktop agent stack with real browser automation, MCP interoperability, and reusable task infrastructure.

Good contribution areas:

- browser and desktop workflow reliability,
- MCP client/server interoperability,
- task trace and result UX,
- templates and workflow packs,
- skills and reusable capability packaging,
- release quality, tests, and docs.

## Community

- Issues: https://github.com/LeonGaoHaining/opencowork/issues
- Discussions: https://github.com/LeonGaoHaining/opencowork/discussions
- Releases: https://github.com/LeonGaoHaining/opencowork/releases
- Website: https://opencowork.me

## License

Apache-2.0. See `LICENSE`.
