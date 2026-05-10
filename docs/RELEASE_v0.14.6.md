# OpenCowork v0.14.6 Release Notes

| Item | Value |
| --- | --- |
| Version | `v0.14.6` |
| Date | 2026-05-10 |
| Release type | Runtime stability, cleanup, and task-state reliability release |
| Previous tag | `v0.14.5` |

## Release Focus

`v0.14.6` improves reliability for local-first desktop AI automation. The release focuses on preventing long-running task corruption, cleaning up child processes and MCP stdio resources, preserving task history writes, and keeping renderer task status tied to the active run.

This is an open-source stability release. It is intended for builders, researchers, product teams, and design partners evaluating OpenCowork on a local desktop, VM, or dedicated automation device. It does not introduce hosted SaaS claims, commercial pricing, or production certification language.

## Highlights

- Task execution now aborts cleanly after unrecoverable node failures instead of continuing into later nodes and potentially overwriting failed state with completed state.
- CLI action timeouts now terminate the spawned child process and avoid duplicate Promise resolution.
- History persistence now preserves records added while an SQLite flush is already in progress.
- MCP stdio connection failure, connection timeout, disconnect, and pending request cleanup paths now release resources more consistently.
- Desktop harness launch and shutdown commands now have timeout protection.
- Visual automation destroys adapter sessions even when computer cleanup fails.
- Renderer task events are filtered by the current run or task handle to reduce stale completed, failed, or status updates.
- Ask User responses now await IPC delivery, and direct session message loads are bounded.

## Why It Matters

OpenCowork can operate a headed browser, run local commands, connect MCP tools, process files, and execute visual desktop workflows. These capabilities are useful for local AI automation, but they require careful lifecycle management. This release reduces failure modes that can otherwise cause stuck tasks, leaked processes, misleading UI state, or missing task history.

## Recommended Evaluation Path

- Run OpenCowork on a trusted local machine, virtual machine, or dedicated AI automation device.
- Keep `config/llm.json`, IM credentials, tokens, cookies, local databases, and generated artifacts out of Git.
- Start with supervised workflows before scheduling unattended runs.
- Review browser, CLI, MCP, and visual automation behavior before using templates repeatedly.
- Treat third-party MCP servers and skills as extensions of the local execution surface.

## Verification

```bash
npm run build
```

Full-suite status:

```bash
npm run test:run
```

The full suite currently reports existing UI/i18n text assertion failures in `IMConfigPanel`, `SkillPanel`, and `TemplatePanel`. These are tracked as follow-up release quality work and are not introduced by the `v0.14.6` stability changes.

## Publishing Checklist

1. Commit release docs and version metadata.
2. Use existing tag `v0.14.6`.
3. Push the docs commit to `main`.
4. Create a GitHub Release for `v0.14.6` using this file as the body.

GitHub release publishing requires `gh` authentication or a `GH_TOKEN` with release permissions.
