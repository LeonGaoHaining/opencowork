# OpenCowork v0.12.10 Release Notes

| Item | Value |
| --- | --- |
| Version | `v0.12.10` |
| Date | 2026-05-02 |
| Release type | Documentation, open-source release surface, roadmap/spec alignment |
| Previous tag | `v0.12.9` |

## Release Focus

This release refreshes OpenCowork's public open-source surface and aligns the project documentation with the current Agent Runtime platformization direction.

The product is now presented as a desktop AI work system for browser automation, desktop/hybrid workflows, MCP-native tools, reusable task runs, templates, skills, IM delivery, and result-first execution.

## Highlights

- Updated `README.md` for a stronger open-source landing page and current release positioning.
- Updated `USER_GUIDE.md` with current workflows for task execution, results, templates, skills, MCP, IM, and runtime direction.
- Added PRD 7.0 planning to `docs/PRD.md`.
- Added `docs/SPEC_P5_agent-runtime-platformization.md` for shared protocol, runtime API, unified approval, structured output, Plan Mode, workspace rules, trace/diff, config, and TaskEngine decomposition.
- Updated `docs/ROADMAP.md` with P5 Agent Runtime platformization.
- Updated `docs/ARCHITECTURE.md` to describe the target Agent Runtime architecture.
- Updated `CONTRIBUTING.md`, `SECURITY.md`, and GitHub issue/PR templates for open-source collaboration quality.
- Bumped `package.json` and `package-lock.json` to `0.12.10`.

## What Changed for Users

- The public docs now better explain what OpenCowork does today and where it is going next.
- The recommended product story is now clearer: result-first desktop AI work, reusable runs, MCP-native tools, and runtime platformization.
- Users and contributors have clearer entry points for setup, troubleshooting, issue reporting, and roadmap context.

## What Changed for Contributors

- Contribution guidance now highlights high-impact work areas.
- Issue templates now collect environment, product area, impact, and verification context.
- PR template now asks for verification, user-facing docs, risk notes, and product area.
- Security policy now calls out local config, credential handling, task stability, cleanup, and data corruption risks.

## Runtime Roadmap Note

`v0.12.10` does not implement the P5 runtime migration yet. It establishes the public plan and technical specification for that work.

The P5 target is a reusable local Agent Runtime with:

- shared protocol,
- `AgentRuntimeApi`,
- unified approval policy,
- structured execution output,
- Plan Mode,
- workspace rules,
- trace and diff artifacts,
- centralized config,
- smaller runtime services around the existing `TaskEngine` facade.

## Verification

Recommended checks for this release:

```bash
npm run test:run
npm run build
```

## Publishing Checklist

1. Commit release docs and version metadata.
2. Tag `v0.12.10`.
3. Push branch and tag.
4. Create a GitHub Release using this file as the body.

GitHub release publishing requires a valid `gh` login or `GH_TOKEN`.
