# Stage 05 - Conditional Test Stage

## Hook definition

- Stage ID: `05`
- Command: `npm run test`
- Source script: orchestrated by `scripts/pre_push_quality_gate.sh`
- Trigger condition:
  - `test` script exists in `package.json`
  - repository contains test files (`__tests__` or `*.test|*.spec`)
  - push diff includes test-relevant files (app code, test files, or core config)
- Result: blocks push only when this stage executes and tests fail

## Purpose

Run tests when they are meaningful for the current push, while avoiding false failures in repositories without an active automated test suite.

## Typical failures

- Behavioral regressions in app screens or business logic.
- Outdated test expectations after code changes.
- Missing test setup in local environment.

## Skip cases

This stage is skipped when:

- `package.json` has no `test` script.
- No test files are present in the repository.
- Changed files are not related to test-relevant app surfaces.

## Fix

1. Review failing test output.
2. Fix code or test contracts as needed.
3. Re-run tests.
4. Re-run full pre-push gate.

Useful commands:

```bash
npm run test
npm run prepush:gate
```
