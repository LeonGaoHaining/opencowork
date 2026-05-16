<h1 align="center">OpenCowork</h1>

<p align="center"><strong>Open-source, local-first desktop AI agent runtime for evaluating browser automation, MCP workflows, skills, and reusable task runs.</strong></p>

<p align="center">
  <a href="https://github.com/LeonGaoHaining/opencowork/stargazers"><img src="https://img.shields.io/github/stars/LeonGaoHaining/opencowork?style=social" alt="stars"></a>
  <a href="https://github.com/LeonGaoHaining/opencowork/releases"><img src="https://img.shields.io/github/v/release/LeonGaoHaining/opencowork?include_prereleases" alt="release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/LeonGaoHaining/opencowork" alt="license"></a>
  <a href="https://github.com/LeonGaoHaining/opencowork/issues"><img src="https://img.shields.io/github/issues/LeonGaoHaining/opencowork" alt="issues"></a>
  <a href="https://opencowork.me"><img src="https://img.shields.io/badge/Website-opencowork.me-brightgreen" alt="website"></a>
</p>

## Why OpenCowork

OpenCowork is for builders, researchers, and product teams evaluating how a local desktop AI agent can operate a browser, call local tools, use MCP integrations, preserve task history, and reuse successful runs as templates.

The core product idea is simple: describe a goal, let the agent operate local tools and websites under human oversight, review the result, then turn a successful run into a reusable workflow. OpenCowork is not positioned as a production-certified RPA suite, hosted SaaS platform, or generic chatbot.

The product direction is result-first:

- finish useful tasks, not just stream reasoning,
- preserve task runs as inspectable records,
- turn successful runs into reusable templates,
- connect local desktop execution with IM, Scheduler, Skills, and MCP,
- make browser and desktop automation observable, recoverable, and repeatable.

## Open-Source Positioning

OpenCowork is an open-source evaluation and development project. It is currently best suited for local experimentation, workflow prototyping, contributor-driven feature work, and design-partner-style evaluation on machines controlled by the user.

The project intentionally avoids claiming hosted availability, production certification, enterprise compliance, guaranteed task success, published commercial pricing, or managed service-level commitments.

Good fit:

- technical or semi-technical users evaluating local AI automation,
- privacy-sensitive teams that prefer local execution and BYO model keys,
- operations, research, sales, and consulting teams with repeated browser-heavy work,
- product and agent teams building on MCP, Hybrid CUA, task traces, and reusable runtime APIs,
- contributors and design partners who can test local-first workflows and report limitations clearly.

Not the current focus:

- a fully hosted multi-tenant SaaS platform,
- a generic personal chatbot,
- a no-code RPA replacement for every enterprise process,
- a production claims package with published commercial pricing or SLA language.

## Typical Scenarios

| Scenario | What OpenCowork does | Typical output |
| --- | --- | --- |
| Market and sales research | Opens websites, searches companies, extracts public information, compares competitors, and summarizes findings | Research brief, lead list, pricing watch, PPT outline |
| Operations file processing | Receives files or screenshots through IM, analyzes them, applies repeatable rules, and sends result files back | Cleaned spreadsheet, OCR result, structured report |
| Internal tool workflows | Connects MCP tools, browser back offices, local scripts, and skills into one task run | Reusable workflow template, run record, artifacts |
| Browser back-office automation | Helps operate web consoles, forms, dashboards, approvals, and long-tail manual workflows under user oversight | Operation attempt, trace, screenshot evidence |
| Scheduled knowledge work | Runs recurring checks, summaries, monitoring, and weekly/monthly reporting through templates | Daily report, weekly digest, monitoring summary |
| Agent runtime experiments | Provides a local runtime surface for browser/desktop computer-use, MCP client/server, approval, and trace UX | Runtime prototype, benchmark trace, reusable adapter |

## What You Can Build

OpenCowork can be used as a practical foundation for:

- local AI automation pilots for research, operations, sales, and consulting teams,
- scenario-specific workflow packages that turn successful task runs into templates,
- private deployment experiments for teams that need local execution,
- MCP-native local agent workflows that connect internal tools and external services,
- Feishu-driven task intake, file analysis, progress updates, and result delivery,
- desktop computer-use experiments with approval, trace, and benchmark loops,
- open-source agent runtime research around protocol, trace, and multi-client reuse.

## Current Release: v0.14.9

`v0.14.9` keeps the desktop footer stable when localized control labels are long. It builds on `v0.14.8`, which automatically rebuilds native SQLite modules for the installed Electron runtime after `npm install`.

Highlights:

- adds compact footer button styling used only by the bottom control bar,
- reduces footer spacing and preview icon button size,
- truncates center task status text instead of letting it deform surrounding controls,
- keeps native `better-sqlite3` rebuilds aligned with Electron through `postinstall`,
- documents Node.js 20 or 22 LTS as the supported development baseline.

Recent product milestones:

- `v0.14.9`: footer control bar compact layout and release version sync.
- `v0.14.8`: Electron native module rebuilds after install and Node requirement documentation.
- `v0.14.7`: cross-platform startup cleanup, restored settings manager tracking, and release version sync.
- `v0.14.6`: runtime stability, cleanup coverage, MCP stdio lifecycle hardening, and task UI event isolation.
- `v0.14.5`: i18n coverage and release polish.
- `v0.14.4`: Feishu follow-up context and browser visual/computer-use reliability.
- `v0.14.2`: session template save, template-run UI hardening, result overflow fixes, and immediate new-session switching.

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

## Open-Source Marketing Notes

OpenCowork remains an open-source project. Public descriptions should be factual, capability-based, and clear about current limitations.

Use language that says the project can help users evaluate or prototype:

- local-first desktop AI automation,
- browser and MCP workflow experiments,
- reusable task and template patterns,
- human-supervised execution and trace inspection,
- contributor-driven runtime research.

Avoid language that implies OpenCowork currently provides hosted SaaS, enterprise certification, guaranteed automation success, compliance attestations, commercial pricing, or managed support SLAs.

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

## Security Notice

OpenCowork is a local-first desktop AI agent runtime. It can operate a headed browser, call local tools, connect to MCP servers, process files, run scheduled workflows, and integrate with IM systems such as Feishu. Because the agent can perform real actions in a local desktop environment, users should treat it as a trusted automation tool with operating privileges, not as a sandboxed chatbot.

To reduce the risk of accidental operations, credential exposure, and data leakage, we recommend running OpenCowork on a dedicated AI automation device, virtual machine, or isolated system account. Avoid mixing it with personal daily-use environments, production administrator accounts, or high-sensitivity data workspaces.

Recommended usage:

- Run OpenCowork on a dedicated AI device, virtual machine, or isolated system account whenever possible.
- Use OpenCowork only on machines, networks, and operating system accounts you trust.
- Review agent actions before allowing access to sensitive websites, internal systems, credentials, private files, or production environments.
- Keep model and integration configuration local. Do not commit `config/llm.json`, `config/feishu.json`, API keys, tokens, cookies, generated databases, or private task artifacts.
- Use placeholder credentials in examples, documentation, issues, and pull requests.
- Be careful when connecting external MCP servers or installing third-party skills, because they may extend what the agent can access or execute.
- For scheduled tasks and reusable templates, verify the workflow behavior before running it unattended.
- Report sensitive security findings through GitHub Security Advisories instead of public issues.

OpenCowork is commonly used in trusted single-user desktop deployments. This reduces some multi-tenant web risks, but credential leakage, unsafe remote access, uncontrolled task execution, data loss, persistent crashes, and resource leaks remain important security concerns and should be reported responsibly.

See `SECURITY.md` for the vulnerability reporting policy.


## Quick Start

### Requirements

- Node.js 20 or 22 LTS
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

`npm install` automatically rebuilds native modules such as `better-sqlite3` for the installed Electron runtime. If you switch Node or Electron versions, rerun `npm install` or `npm run rebuild:native` before launching the app.

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

On Windows, macOS, and Linux, `electron:dev` now uses a Node-based source cleanup step, so it no longer depends on a Unix-only `find` command.

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
- `CHANGELOG.md` — current release notes and release history
- `CONTRIBUTING.md` — contribution workflow
- `SECURITY.md` — vulnerability reporting policy

## Open Source Status

OpenCowork is actively evolving. The current release line is best suited for builders, researchers, and product teams who want to evaluate or contribute to a local desktop agent stack with browser automation, MCP interoperability, and reusable task infrastructure.

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
