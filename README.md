<h1 align="center">OpenCowork</h1>

<p align="center"><strong>An open-source desktop AI agent that can browse, search, execute skills, expose MCP tools, and complete real work on your computer.</strong></p>

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
| Human-in-the-loop  | Pause, resume, interrupt, and take over tasks                 |
| International UI   | English-first UI with Chinese support                         |

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
- and a project that is actively shipping core agent infrastructure.

## Community

- Issues: https://github.com/LeonGaoHaining/opencowork/issues
- Discussions: https://github.com/LeonGaoHaining/opencowork/discussions
- Website: https://opencowork.me

## License

Apache-2.0. See `LICENSE`.
