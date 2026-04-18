# Contributing to OpenCowork

Thanks for your interest in OpenCowork. We welcome contributions across product, code, docs, testing, integrations, and community support.

## Ways to Contribute

- Report bugs
- Improve documentation
- Propose product or DX improvements
- Submit fixes and new features
- Add tests
- Improve translations
- Help validate real-world desktop agent workflows

## Development Setup

```bash
git clone https://github.com/YOUR_USERNAME/opencowork.git
cd opencowork
npm install
npm run electron:dev
```

## Branching

Create feature branches from `main`.

Examples:

```bash
git checkout -b feature/mcp-improvement
git checkout -b fix/browser-followup-context
```

## Code Quality Expectations

- Use TypeScript.
- Keep changes focused and minimal.
- Prefer small, reviewable pull requests.
- Update public docs when user-facing behavior changes.
- Run the relevant build or test command before opening a PR.

Common commands:

```bash
npm run build
npm run test:run
npm run lint
```

## Commit Style

Use concise, descriptive commits.

Preferred examples:

- `feat: add standard MCP server endpoint`
- `fix: preserve follow-up thread context`
- `docs: refresh public product documentation`

## Pull Requests

Please include:

- what changed,
- why it matters,
- how it was verified,
- and any known limitations.

If your change affects the product experience, include screenshots or logs where helpful.

## Scope Guidance

Good contribution areas right now:

- browser task reliability,
- MCP client and server interoperability,
- skill UX,
- docs polish,
- history and restore flows,
- testing and release quality.

## Need Help?

- Open an issue for bugs and requests.
- Use discussions for broader product or design topics.

Thanks for helping make OpenCowork a better open-source desktop agent.
