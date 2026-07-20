# Security Policy

## Supported Versions

Only the latest release (`v1.x`) receives security updates.

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email **security@videomind.ai** with:
- A description of the issue and its impact
- Steps to reproduce (PoC if possible)
- Affected version / commit

We will acknowledge within **48 hours** and aim for a fix + disclosure within **30 days**. Responsible disclosure will be credited (unless you prefer to remain anonymous).

## Scope

- The open-source core in this repository (collect / ASR / analyze / report / desktop shell).
- Out of scope: vulnerabilities in upstream dependencies (report to the respective project), issues requiring already-compromised environments, self-XSS.

## Notes

- API keys (LLM providers, platform cookies) are stored **locally only** (SQLite / keyring). Treat your own keys as secrets — we never transmit them anywhere except the provider you configured.
- The desktop app spawns a local backend on `127.0.0.1` (random port). Do not expose it to untrusted networks.
