<h1 align="center">OpenCowork</h1>

<p align="center"><strong>Open-source, local-first desktop AI Agent Runtime for turning business goals into executable, reusable, and auditable workflows.</strong></p>

<p align="center">
  <a href="https://github.com/LeonGaoHaining/opencowork/stargazers"><img src="https://img.shields.io/github/stars/LeonGaoHaining/opencowork?style=social" alt="stars"></a>
  <a href="https://github.com/LeonGaoHaining/opencowork/releases"><img src="https://img.shields.io/github/v/release/LeonGaoHaining/opencowork?include_prereleases" alt="release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/LeonGaoHaining/opencowork" alt="license"></a>
  <a href="https://github.com/LeonGaoHaining/opencowork/issues"><img src="https://img.shields.io/github/issues/LeonGaoHaining/opencowork" alt="issues"></a>
  <a href="https://opencowork.me"><img src="https://img.shields.io/badge/Website-opencowork.me-brightgreen" alt="website"></a>
</p>

## Why OpenCowork

OpenCowork is for teams that want an AI agent to do real work on a local desktop, not only answer chat messages. It combines a headed browser, local execution, reusable skills, MCP integrations, task history, templates, scheduling, IM file workflows, and human-in-the-loop approval into one desktop-native agent system.

The core product idea is simple: describe a business outcome, let the agent operate local tools and websites, review the result, then turn the successful run into a reusable workflow. OpenCowork is not positioned as a generic chatbot or a traditional RPA recorder. It is a local AI automation layer for repeatable knowledge work where execution, traceability, privacy, and result reuse matter.

The product direction is result-first:

- finish useful tasks, not just stream reasoning,
- preserve task runs as inspectable records,
- turn successful runs into reusable templates,
- connect local desktop execution with IM, Scheduler, Skills, and MCP,
- make browser and desktop automation observable, recoverable, and repeatable.

## Product Positioning

OpenCowork is currently best suited for builders, researchers, product teams, and early enterprise design partners who need local execution, BYO model configuration, browser automation, and private workflow delivery.

The strongest early fit is not low-price self-serve SaaS. It is high-value, scenario-driven automation where a team wants a local AI worker that can be deployed privately, connected to internal tools, and supported through repeatable workflow packages.

Good fit:

- technical or semi-technical teams evaluating local AI automation,
- privacy-sensitive teams that prefer local execution and BYO model keys,
- operations, research, sales, and consulting teams with repeated browser-heavy work,
- product and agent teams building on MCP, Hybrid CUA, task traces, and reusable runtime APIs,
- enterprise pilots that need private deployment, scenario delivery, templates, and annual support.

Not the current focus:

- a fully hosted multi-tenant SaaS platform,
- a generic personal chatbot,
- a no-code RPA replacement for every enterprise process,
- a production claims package with published commercial pricing.

## Typical Scenarios

| Scenario | What OpenCowork does | Typical output |
| --- | --- | --- |
| Market and sales research | Opens websites, searches companies, extracts public information, compares competitors, and summarizes findings | Research brief, lead list, pricing watch, PPT outline |
| Operations file processing | Receives files or screenshots through IM, analyzes them, applies repeatable rules, and sends result files back | Cleaned spreadsheet, OCR result, structured report |
| Internal tool workflows | Connects MCP tools, browser back offices, local scripts, and skills into one task run | Reusable workflow template, run record, artifacts |
| Browser back-office automation | Handles non-standard web consoles, forms, dashboards, approvals, and long-tail manual workflows | Completed operation, audit trace, screenshot evidence |
| Scheduled knowledge work | Runs recurring checks, summaries, monitoring, and weekly/monthly reporting through templates | Daily report, weekly digest, monitoring summary |
| Agent runtime experiments | Provides a local runtime surface for browser/desktop computer-use, MCP client/server, approval, and trace UX | Runtime prototype, benchmark trace, reusable adapter |

## What You Can Build

OpenCowork is a practical foundation for:

- local AI automation pilots for research, operations, sales, and consulting teams,
- scenario-specific workflow packages that turn successful task runs into templates,
- private deployment and annual support offerings for teams that need local execution,
- MCP-native local agent workflows that connect internal tools and external services,
- Feishu-driven task intake, file analysis, progress updates, and result delivery,
- desktop computer-use experiments with approval, trace, and benchmark loops,
- open-source agent runtime research around protocol, trace, and multi-client reuse.

## Current Release: v0.14.2

`v0.14.2` focuses on release polish for the current desktop AI workflow surface: skill uninstall correctness, session-scoped successful workflow templates, safer template reruns, cleaner chat/result overflow handling, and immediate session switching after creating a new session.

Highlights:

- fixed skill uninstall so installed skill folders are removed by their actual persisted path,
- added a session-level successful workflow save path that creates templates only from completed chat runs in the active session,
- kept full template prompts for execution while showing short run titles in chat, task status, and logs,
- hardened long text rendering in chat messages, task status, and result delivery surfaces,
- made the new-session button immediately switch the chat UI into the created session.

Recent product milestones:

- `v0.14.2`: session template save, template-run UI hardening, result overflow fixes, and immediate new-session switching.
- `v0.14.1`: skill uninstall fix and current skill management release polish.
- `v0.14.0`: Agent Runtime baseline and release-line alignment.
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

## Commercial Direction

OpenCowork remains an open-source project. The commercial direction is to use open-source distribution for adoption while productizing high-value local AI automation services around the runtime.

Current recommended commercialization path:

- design partner pilots around a small number of standard scenarios,
- scenario-based workflow delivery for market research, operations file processing, and MCP-connected internal tools,
- private deployment guidance and annual support for teams that need local-first AI automation,
- reusable industry template packs and workflow packs created from proven customer runs,
- training, implementation partners, and a lightweight team edition after installability, support, and template reuse are stronger.

This direction avoids premature dependence on a heavy multi-tenant cloud platform. It prioritizes high-ARPU design partners, repeatable templates, local deployment trust, and measurable business outputs before broader self-serve subscriptions.

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


## Quick Start

### Requirements

- Node.js 18+
- npm 9+
- Python 3.8+
- A valid LLM API configuration in `config/llm.json`

### Install Prerequisites

macOS:

```bash
brew install node python
node -v
npm -v
python3 --version
```

Ubuntu / Debian:

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip
node -v
npm -v
python3 --version
```

Windows:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.12
node -v
npm -v
python --version
```

### Install

```bash
git clone https://github.com/LeonGaoHaining/opencowork.git
cd opencowork
npm install
npx playwright install chromium
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
- `docs/RELEASE_v0.14.2.md` — current release notes
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
