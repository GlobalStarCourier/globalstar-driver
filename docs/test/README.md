# Mobile Test Guide

## Commands

- Local run: `npm run test`
- Watch mode: `npm run test:watch`
- CI mode (no watch): `npm run test:ci`

The pre-push gate also triggers `npm run test` when test-relevant files change.

## Setup

Test runner and libraries:

- `jest`
- `jest-expo` preset
- `@testing-library/react-native`
- `react-test-renderer`

Configuration files:

- `jest.config.js`
- `jest.setup.js`

Environment notes:

- No mandatory test-only environment variables are required for the current suites.
- Auth flows can use real env vars from `.env` (for example `EXPO_PUBLIC_AUTH_API_BASE_URL`) without changing test commands.

## Native Mock Strategy

To keep suites deterministic and hardware-independent:

- `react-native-safe-area-context` is mocked using the package Jest mock.
- Screen tests mock `useAuth` to isolate UI contract from network/auth provider internals.

Current tests do not rely on real camera, gallery, or location hardware state.

## Test Location and Naming Convention

- Root test folder: `__tests__/`
- File naming: `*.test.js`
- Structure by feature surface:
  - `__tests__/screens/...`
  - `__tests__/components/...`
  - `__tests__/context/...`

## Current Suite Coverage

- `LoginScreen`: submit payload, error rendering, password visibility toggle.
- `PasswordChangeRequiredScreen`: password-change submit contract, fallback error, disabled logout during submit.
- `AppInput`: label/error/icons rendering, text change propagation, non-editable state.
- `AppButton`: press behavior, loading state, disabled state.
- `driverScanValidation`: strict scan-response guards so QR scans only apply to the selected assigned order row.
- `PackageContext`: refresh regression guard so failed assigned-orders refresh keeps the last valid route list, plus `401` retry flow that refreshes mobile session token before re-requesting assigned orders.
