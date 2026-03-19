# Pre-commit Hook Guide (Mobile)

## Purpose

The `pre-commit` hook enforces staged-file quality before a commit is created.

It runs linting and formatting only for files included in the commit.
If any check fails, the commit is blocked.

## Install

Install dependencies and hooks once per clone:

```bash
npm install
```

If you need to reinstall hooks manually:

```bash
npm run prepare
```

## What runs in `pre-commit`

Hook entrypoint:

- `.husky/pre-commit` -> `npm run precommit:staged`

Command executed:

- `lint-staged --concurrent false`

`lint-staged` rules are defined in `.lintstagedrc.json`:

- `*.{js,jsx,ts,tsx,mjs,cjs}`
  - `eslint --fix --max-warnings=0`
  - `prettier --write`
- `*.{json,md,css,scss,html,yml,yaml}`
  - `prettier --write`

## Expected workflow

1. Stage files with `git add ...`.
2. Run `git commit ...`.
3. If lint/format can auto-fix staged files, `lint-staged` applies and stages those changes automatically.
4. If a task fails (for example, unresolved lint errors), the commit is blocked and must be fixed.

## Manual execution

Run the same staged-file gate manually:

```bash
npm run precommit:staged
```

## Troubleshooting

- `lint-staged: command not found`
  Run `npm install`.
- Hook not running
  Reinstall hooks with `npm run prepare`.
- ESLint or Prettier failures
  Apply fixes, re-stage files, and retry the commit.
