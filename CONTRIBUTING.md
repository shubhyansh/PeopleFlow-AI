# Contributing to FlowDesk

Thanks for considering a contribution. This project is small, opinionated, and built around the idea that vague briefs are a bug. Same rule applies to PRs.

## Before you start

- Open an issue first for anything bigger than a typo or a one-file fix. A 30-second discussion saves an hour of rework.
- Check the [Roadmap section in the README](../README.md#-the-roadmap) — items marked 🟡 are open for help. Items marked ✅ are stable; please don't refactor them without a reason.
- Check existing issues and PRs to avoid duplicate work.

## Local setup

The full developer setup lives in the README under [Quick start (for developers)](../README.md#-quick-start-for-developers--running-from-source). Short version:

```bash
git clone git@github.com:shubhyansh/PeopleFlow-AI.git
cd PeopleFlow-AI
npm install
cp .env.example .env   # fill in Supabase + Groq values
npm run dev
```

Sign in as `admin` / `Admin@123` and start poking.

## Development workflow

1. Fork the repo and create a feature branch off `main`:
   ```bash
   git checkout -b feat/short-name-of-thing
   ```
2. Make focused commits. Branch names and commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new user-visible capability
   - `fix:` bug fix
   - `refactor:` no behaviour change
   - `docs:`, `test:`, `chore:`, `ci:`, `perf:`
3. Keep one logical change per commit. Squash fixups before opening the PR.
4. Run the checks before pushing:
   ```bash
   npm run typecheck
   npm run lint
   ```
5. Push, open a PR against `main`, and fill in the PR template.

## What "good" looks like for a PR

- A title that would survive its own FlowDesk interview — concrete, scoped, no `update` / `wip`.
- A description that answers: what changed, why, how to verify. Screenshots/GIFs for any UI change.
- The smallest diff that solves the problem. If the change touches more than ~400 lines, consider splitting.
- No unrelated formatting churn — `npm run format` only on files you actually edited.
- No new dependencies without a one-line justification in the PR body.
- No `.env`, no real Supabase URLs, no Groq keys, no personal seed data.

## Testing

This project doesn't yet have an enforced test suite, but new logic in `src/lib/` is the right place to start adding one. If you're adding a pure function (e.g. layout, lifecycle, parser), please include a small test file alongside it. Use whatever the rest of the file is using; if there's nothing, plain `node:test` is fine.

For UI changes, manual verification against the steps in [`docs/VERIFICATION.md`](docs/VERIFICATION.md) is required.

## What to avoid

- Pulling in heavyweight UI libraries — the styling system is intentionally Tailwind + Framer Motion only.
- Putting Groq calls in the renderer — the Groq key lives in the main process and stays there.
- Hardcoding Supabase URLs/keys anywhere in source. Configuration is per-install via the setup screen.
- Touching the `LICENSE` file unless that is the explicit subject of the PR.

## Reporting bugs

Open an issue using the **Bug report** template. The faster you can hand over a 5-line repro, the faster it gets fixed. If the bug only reproduces against your specific Supabase project, please share the schema diff (not the data).

## Reporting security issues

Don't open a public issue for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be the PM you wish you'd had.
