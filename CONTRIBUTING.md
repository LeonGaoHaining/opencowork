# Contributing to OpenCowork

Thanks for helping build OpenCowork. The project is an open-source desktop AI agent runtime focused on browser automation, local workflows, MCP interoperability, reusable task runs, skills, and human-supervised execution.

Public project language should stay factual and evaluation-oriented. Do not describe OpenCowork as a hosted SaaS service, production-certified RPA product, enterprise compliance package, guaranteed automation system, or commercial offering with published pricing or support SLAs unless those claims are backed by shipped public artifacts.

## Where Contributions Help Most

High-impact areas:

- browser task reliability,
- desktop and hybrid computer-use workflows,
- MCP client and server interoperability,
- task trace, result, history, and template UX,
- skills and workflow packs,
- Feishu / IM task delivery,
- tests, release quality, and public documentation.

## Development Setup

```bash
git clone https://github.com/YOUR_USERNAME/opencowork.git
cd opencowork
npm install
npm run electron:dev
```

Use Node.js 20 or 22 LTS for development. `npm install` rebuilds native modules for Electron automatically; after changing Node or Electron versions, run `npm run rebuild:native` before `npm run electron:dev`.

## Project Commands

```bash
# Desktop development
npm run electron:dev

# Build
npm run build

# Tests
npm run test:run

# Lint and format
npm run lint
npm run format
```

## Contribution Workflow

1. Open an issue or discussion for larger changes.
2. Create a focused branch from `main`.
3. Keep the pull request small enough to review.
4. Add or update tests for behavioral changes.
5. Update docs when user-facing behavior changes.
6. Include verification steps in the PR description.

Branch examples:

```bash
git checkout -b feature/runtime-trace-artifacts
git checkout -b fix/mcp-tool-argument-forwarding
git checkout -b docs/open-source-release-refresh
```

## Code Quality Expectations

- Use TypeScript for application code.
- Keep changes minimal and targeted.
- Prefer explicit interfaces for shared data shapes.
- Avoid introducing broad rewrites unless there is a documented migration plan.
- Preserve existing user data and historical task compatibility.
- Treat long-running tasks, cleanup, memory growth, and renderer stability as high-priority concerns.

## Documentation Expectations

Update public docs when a change affects:

- installation or configuration,
- task execution behavior,
- MCP usage,
- IM/Feishu workflows,
- skills or templates,
- approval, recovery, or human oversight,
- release notes or roadmap commitments.

Common docs:

- `README.md`
- `USER_GUIDE.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

Marketing and release copy should:

- describe current capabilities, not future promises,
- distinguish shipped behavior from roadmap work,
- mention human oversight for browser, desktop, CLI, IM, MCP, and scheduled workflows,
- avoid unsupported claims about compliance, certification, uptime, pricing, or enterprise readiness,
- use placeholders and never include real credentials, customer data, or private deployment details.

## Commit Style

Use concise, descriptive commits.

Examples:

- `feat: add runtime trace artifacts`
- `fix: preserve Feishu reply target`
- `docs: refresh open-source release messaging`
- `test: cover MCP tool approval policy`

## Pull Request Checklist

Before opening a PR, make sure you can answer:

- What changed?
- Why does it matter?
- How was it verified?
- What are the limitations or follow-ups?
- Does this affect docs, config, migrations, or user data?

If the change affects product experience, include screenshots, logs, or a short screen recording when practical.

## Security and Credentials

- Do not commit files under `config/`.
- Do not commit API keys, Feishu credentials, cookies, tokens, or local databases.
- Use placeholders in examples.
- Report sensitive security issues through GitHub Security Advisories instead of public issues.

## Need Help?

- Use issues for bugs and scoped tasks.
- Use discussions for larger product or architecture questions.
- Read `docs/ROADMAP.md` and `docs/SPEC_P5_agent-runtime-platformization.md` for the current direction.

Thanks for helping make OpenCowork a stronger open-source desktop agent stack.
