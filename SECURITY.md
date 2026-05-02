# Security Policy

We take security issues seriously and appreciate responsible disclosure.

OpenCowork is often deployed as a trusted, single-user desktop agent. That deployment model changes some risk priorities, but it does not remove the need to report meaningful vulnerabilities, especially issues that can cause crashes, credential exposure, data loss, runaway execution, or unsafe remote access.

## Supported Versions

Security fixes are released on the latest active release line whenever practical.

| Version | Status |
| --- | --- |
| `v0.12.x` | Active |
| Older versions | Best effort |

## Reporting a Vulnerability

Please use GitHub Security Advisories instead of opening a public issue for sensitive findings.

- Security Advisories: https://github.com/LeonGaoHaining/opencowork/security/advisories
- Contact: leon.gao@opencowork.com

## What to Include

Please include:

- affected version or commit,
- operating system,
- severity assessment,
- reproduction steps,
- expected vs actual behavior,
- logs or screenshots when safe to share,
- suggested remediation if available.

Do not include live API keys, Feishu credentials, cookies, tokens, private task data, or local database dumps in public reports.

## Response Targets

| Severity | First Response | Target Fix Window |
| --- | --- | --- |
| Critical | 24 hours | 7 days |
| High | 3 days | 14 days |
| Medium | 7 days | 30 days |
| Low | 14 days | 90 days |

## Priority Areas

We especially care about:

- credential leakage,
- local config exposure,
- remote access bypasses,
- uncontrolled task execution,
- persistent denial of service or renderer/main-process crashes,
- data corruption in task history, templates, skills, or result storage,
- cleanup failures that can cause long-running resource leaks.

## Local Configuration Safety

- Keep `config/` local to your machine.
- Never commit `config/llm.json`, `config/feishu.json`, local tokens, cookies, or generated databases.
- Example docs must use placeholder credentials only.

## Security Release Process

Security fixes are released in patch versions whenever possible.

Example:

- `v0.12.9` -> `v0.12.10`

## Thanks

We appreciate responsible disclosure and will credit reporters when appropriate.
