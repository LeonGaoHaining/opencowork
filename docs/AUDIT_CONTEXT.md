# Audit Context

This document explains the operating assumptions used when reviewing OpenCowork changes.

## Deployment Context

OpenCowork is frequently used in a trusted single-user AI device environment.

That means code review should focus first on issues that break runtime stability, task continuity, and long-running reliability.

## Review Priorities

### P0

- memory leaks,
- process crashes,
- resource leaks,
- hung tasks with no timeout protection,
- severe race conditions.

### P1

- intermittent race conditions,
- missing timeout protection,
- data corruption or unguarded parsing,
- busy loops and avoidable performance degradation.

### P2

- general type-safety debt,
- duplication,
- minor maintainability concerns.

## Review Emphasis

- listener cleanup,
- timer cleanup,
- bounded in-memory collections,
- async error handling,
- recoverability after partial failure,
- browser and window cleanup,
- checkpoint and restore safety.

## Why This Matters

OpenCowork is an agent runtime, not just a UI app. The most important failures are the ones that quietly degrade long-running automation or destabilize operator trust.
