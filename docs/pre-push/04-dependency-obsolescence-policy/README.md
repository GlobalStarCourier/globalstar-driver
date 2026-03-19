# Stage 04 - Dependency Obsolescence Policy

## Hook definition

- Stage ID: `04`
- Command: `npm run deps:outdated`
- Source script: `node ./scripts/pre_push_dependency_obsolescence_check.mjs`
- Trigger condition: runs on every push
- Scope: dependencies and devDependencies returned by `npm outdated --json --long`
- Result:
  - prints recommendations for every outdated package using a 4-level scale
  - includes package detail with `current`, `wanted`, and `latest` versions
  - reports prerelease pins newer than latest stable as informational and excludes them from obsolescence scoring
  - down-scores Expo SDK-managed packages pinned by current range to avoid false critical blockers
  - blocks push only when `CRITICAL` obsolescence exists

## Purpose

Keep dependencies current with explicit urgency levels and actionable recommendations.

## Severity scale

- `LOW`: patch-level lag
- `MEDIUM`: minor-level lag
- `HIGH`: one major version behind
- `CRITICAL`: two or more major versions behind

Push is blocked only for `CRITICAL` cases.

Expo/React Native SDK-managed packages may show as outdated to latest npm versions while still being correctly pinned for the current SDK; those are reported with recommendations but not escalated to `CRITICAL` by default.

## Typical failures

- Runtime or tooling packages lag by two or more major versions.
- `npm outdated` fails unexpectedly.

## Fix

1. Read each recommendation line from stage output.
2. Prioritize `CRITICAL` updates first (required to push).
3. Re-test and rerun stage.

Useful commands:

```bash
npm run deps:outdated
npm install <package>@latest
npm install --save-dev <package>@latest
```
