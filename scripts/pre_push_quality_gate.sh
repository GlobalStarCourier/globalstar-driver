#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_stage() {
  local stage_id="$1"
  local stage_name="$2"
  shift 2
  printf '\n[pre-push][%s] %s\n' "$stage_id" "$stage_name"
  "$@"
}

resolve_diff_base() {
  if git rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
    echo '@{upstream}'
    return
  fi

  for fallback in origin/dev origin/main origin/master; do
    if git rev-parse --verify "$fallback" >/dev/null 2>&1; then
      echo "$fallback"
      return
    fi
  done

  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    echo 'HEAD~1'
    return
  fi

  echo 'HEAD'
}

has_npm_script() {
  local script_name="$1"
  node -e 'const fs=require("node:fs");const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));process.exit(pkg.scripts&&pkg.scripts[process.argv[1]]?0:1);' "$script_name"
}

repo_has_test_files() {
  rg --files | rg -Nq '(^|/)(__tests__/|.*\.(test|spec)\.(js|jsx|ts|tsx)$)'
}

DIFF_BASE="$(resolve_diff_base)"
mapfile -t CHANGED_FILES < <(git diff --name-only --diff-filter=ACMR "$DIFF_BASE"...HEAD)

printf '[pre-push] Diff base: %s\n' "$DIFF_BASE"
printf '[pre-push] Changed files in scope: %s\n' "${#CHANGED_FILES[@]}"

lint_changed_files() {
  mapfile -t lint_files < <(
    printf '%s\n' "${CHANGED_FILES[@]}" | rg -N '\.(js|jsx|ts|tsx|mjs|cjs)$' || true
  )

  if [ "${#lint_files[@]}" -eq 0 ]; then
    echo '[pre-push][01] No JS/TS changed files to lint. Skipping.'
    return 0
  fi

  npx eslint --max-warnings=0 "${lint_files[@]}"
}

format_check_changed_files() {
  mapfile -t format_files < <(
    printf '%s\n' "${CHANGED_FILES[@]}" \
      | rg -N '\.(js|jsx|ts|tsx|mjs|cjs|json|md|css|scss|html|yml|yaml)$' || true
  )

  if [ "${#format_files[@]}" -eq 0 ]; then
    echo '[pre-push][02] No supported changed files for Prettier check. Skipping.'
    return 0
  fi

  npx prettier --check "${format_files[@]}"
}

run_tests_conditionally() {
  if ! has_npm_script 'test'; then
    echo '[pre-push][05] No npm "test" script configured. Skipping.'
    return 0
  fi

  if ! repo_has_test_files; then
    echo '[pre-push][05] No test files detected in repository. Skipping.'
    return 0
  fi

  mapfile -t test_trigger_files < <(
    printf '%s\n' "${CHANGED_FILES[@]}" \
      | rg -N '(^|/)(App\.js|index\.js|app\.json|package(-lock)?\.json|babel\.config\.(js|cjs|mjs)|metro\.config\.(js|cjs|mjs)|jest\.config\.(js|cjs|mjs)|jest\.setup\.(js|cjs|mjs)|screens/|context/|constants/|src/|__tests__/|tests?/|.*\.(test|spec)\.(js|jsx|ts|tsx))' || true
  )

  if [ "${#test_trigger_files[@]}" -eq 0 ]; then
    echo '[pre-push][05] No test-relevant changed files detected. Skipping.'
    return 0
  fi

  npm run test
}

run_stage "01" "Changed-files ESLint check" lint_changed_files
run_stage "02" "Changed-files Prettier check" format_check_changed_files
run_stage "03" "Dependency vulnerability audit (always)" npm run deps:vuln
run_stage "04" "Dependency obsolescence policy (always)" npm run deps:outdated
run_stage "05" "Conditional test execution" run_tests_conditionally

printf '\n[pre-push] All configured quality gates passed.\n'
