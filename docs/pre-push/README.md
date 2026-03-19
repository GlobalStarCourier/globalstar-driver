# Pre-push Hook Guide (Mobile)

## Purpose

The `pre-push` hook enforces project-level quality gates before push.

This repository uses a delta-aware gate:

- lint and format checks run only for files changed in the push scope
- dependency checks run on every push
- obsolescence policy is Expo-aware (SDK-pinned packages are recommended, not falsely escalated)
- tests run conditionally (only when test infrastructure exists and changed files are test-relevant)

If any executed stage fails, push is blocked.

## Install

Install dependencies and hooks once per clone:

```bash
npm install
```

If you need to reinstall hooks manually:

```bash
npm run prepare
```

## Stage index

`pre-push` runs these stages in order:

| Stage | Check                                     | Command                                          | Blocks push   | Details                                                                                      |
| ----- | ----------------------------------------- | ------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------- |
| 01    | ESLint on changed JS/TS files             | `npx eslint --max-warnings=0 <changed-js-files>` | Yes           | [01-eslint-check/README.md](./01-eslint-check/README.md)                                     |
| 02    | Prettier check on changed supported files | `npx prettier --check <changed-supported-files>` | Yes           | [02-prettier-check/README.md](./02-prettier-check/README.md)                                 |
| 03    | Dependency vulnerability audit (always)   | `npm run deps:vuln`                              | Yes           | [03-dependency-vulnerability-audit/README.md](./03-dependency-vulnerability-audit/README.md) |
| 04    | Dependency obsolescence policy (always)   | `npm run deps:outdated`                          | Critical only | [04-dependency-obsolescence-policy/README.md](./04-dependency-obsolescence-policy/README.md) |
| 05    | Conditional test run                      | `npm run test`                                   | Yes           | [05-test-stage/README.md](./05-test-stage/README.md)                                         |

Hook entrypoint:

- `.husky/pre-push` -> `npm run prepush:gate`
- orchestrator script: `scripts/pre_push_quality_gate.sh`

Diff scope resolution used by the orchestrator:

- `@{upstream}` when available
- fallback: `origin/dev`, `origin/main`, `origin/master`
- fallback: `HEAD~1`
- fallback: `HEAD`

## Manual execution

Run all pre-push stages manually:

```bash
npm run prepush:gate
```

Run individual stages:

```bash
npm run deps:vuln
npm run deps:outdated
npm run test
```

## Typical workflow

1. Run `npm run prepush:gate` before pushing.
2. Fix the first failing stage.
3. Re-run the same stage locally.
4. Re-run the full gate.
5. Push again.

## Troubleshooting

- Hook not running
  Reinstall hooks with `npm run prepare`.
- Prettier check failed
  Run `npm run format` or `npx prettier --write <files>` and commit the resulting changes.
- Vulnerability audit failed
  Resolve all vulnerabilities from `npm audit` output before pushing.
- Obsolescence policy failed
  Update dependencies reported with `CRITICAL` severity, then rerun `npm run deps:outdated`.
- Test stage skipped unexpectedly
  Ensure a `test` script exists in `package.json` and test files are present.
