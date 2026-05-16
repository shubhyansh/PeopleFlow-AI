# Security policy

## Supported versions

FlowDesk is pre-1.0; only the latest tagged release on `main` receives security fixes. There is no LTS branch.

| Version | Supported |
|---------|-----------|
| Latest tagged release | ✅ |
| Older releases | ❌ |
| Unreleased `main` | Best-effort |

## Reporting a vulnerability

Please **do not** file a public GitHub issue for security problems.

Instead, email **shubhayansh@gmail.com** with:

- A description of the issue and its impact.
- Steps to reproduce, or a minimal proof of concept.
- The commit hash or release version you tested against.
- Whether the issue requires a specific Supabase row-level-security configuration to reproduce (most likely yes, given how the app is deployed).

You should get a first reply within 7 days. If you don't, please nudge by replying to your own email; mail filters are imperfect.

## Scope

In scope:

- The Electron main process (`electron/`) and the IPC contract (`shared/ipc-contract.ts`).
- Auth, role enforcement, and lead-scope boundaries (`src/auth/`, `src/lib/`).
- Anything that could let one user read or modify another user's tasks within a single Supabase project.
- Anything that could leak the Groq key out of the main process to the renderer or to disk.

Out of scope:

- Issues that require physical access to the host machine.
- Issues caused by misconfigured Supabase RLS in a self-hosted deployment (please configure RLS — see the README).
- Self-XSS or social engineering against the install flow.
- Findings against the bundled dummy seed data.

## Disclosure timeline

The default is coordinated disclosure. Once a fix is shipped in a tagged release, the advisory will be published in the GitHub Security Advisories tab on the repo, crediting the reporter (or anonymous if preferred). I will request a CVE if the impact warrants one.

## What this project does not do

- Does not bundle credentials of any kind into the binary.
- Does not transmit telemetry.
- Does not auto-update — every install pulls from the GitHub Releases page manually.
