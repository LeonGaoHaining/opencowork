# OpenCowork v0.14.2 Release Notes

| Item | Value |
| --- | --- |
| Version | `v0.14.2` |
| Date | 2026-05-04 |
| Release type | Workflow template, session, skill uninstall, and UI hardening release |
| Previous tag | `v0.14.1` |

## Release Focus

`v0.14.2` shipped the workflow-template and session polish slice while tightening the product surfaces that turn successful local AI task runs into reusable workflows. Current public messaging should be interpreted through the open-source evaluation note below.

## Highlights

- Fixed skill uninstall so installed skills are removed by their actual persisted folder path, with legacy path compatibility.
- Added session-level successful workflow template creation from completed chat runs in the active session.
- Excluded failed, cancelled, paused, and confirmation-waiting attempts from session workflow templates.
- Improved template reruns so full prompts are preserved for execution while short titles are shown in chat, task status, run records, and logs.
- Hardened chat messages, task status, active steps, and result delivery against oversized prompt and result text.
- Fixed new session creation so clicking the new session button immediately switches the chat area and current task/result state into the new session.
- Updated public docs, release metadata, and version files for `v0.14.2`.

## What Changed for Users

- Creating a new session now immediately enters that session without needing to click the newly created row.
- Saving a session workflow now produces cleaner templates from successful completed work only.
- Running long templates no longer floods the chat UI or task status with the entire template prompt.
- Result delivery remains usable when summaries, structured data, artifacts, or visual traces are long.
- Uninstalling a skill now removes the installed local skill folder instead of only refreshing UI state.

## Open-Source Marketing Note

This release note is historical. Current public messaging presents OpenCowork as an open-source, local-first evaluation project. It should not be read as a claim of hosted SaaS availability, production certification, enterprise compliance, commercial pricing, guaranteed task success, or managed support SLAs.

This release does not add commercial pricing or customer claims as product features.

## Verification

```bash
npm run build
```

## Publishing Checklist

1. Commit release docs, version metadata, and the included product fixes.
2. Tag `v0.14.2`.
3. Push the branch and tag.
4. Create a GitHub Release using this file as the body.

GitHub release publishing requires the same authenticated GitHub context used to push the tag, such as `gh` login or `GH_TOKEN`.
