# Stage 01 - ESLint Changed-files Check

## Hook definition

- Stage ID: `01`
- Command: `npx eslint --max-warnings=0 <changed-js-files>`
- Scope: only changed files matching `*.{js,jsx,ts,tsx,mjs,cjs}` in the current push diff
- Result: blocks push if lint errors or warnings are found in those files

## Purpose

Validate JavaScript/TypeScript quality for code being pushed.

## Typical failures

- Invalid code patterns detected by ESLint rules in changed files.
- Warnings treated as blockers due to `--max-warnings=0`.
- Stage may skip when no JS/TS files changed.

## Fix

1. Inspect lint output.
2. Apply fixes manually or with auto-fix.
3. Re-run lint.

Useful commands:

```bash
npx eslint --fix <changed-js-files>
npx eslint --max-warnings=0 <changed-js-files>
```
