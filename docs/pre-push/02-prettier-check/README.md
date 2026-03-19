# Stage 02 - Prettier Changed-files Check

## Hook definition

- Stage ID: `02`
- Command: `npx prettier --check <changed-supported-files>`
- Scope: only changed files matching `*.{js,jsx,ts,tsx,mjs,cjs,json,md,css,scss,html,yml,yaml}`
- Result: blocks push if any changed file is not correctly formatted

## Purpose

Ensure formatting standard for files being pushed.

## Typical failures

- Changed files not matching `.prettierrc.json` style.
- Stage may skip when no supported files changed.

## Fix

1. Apply formatting.
2. Review changes.
3. Commit formatted files.
4. Re-run format check.

Useful commands:

```bash
npx prettier --write <changed-supported-files>
npx prettier --check <changed-supported-files>
```
