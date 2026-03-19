#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const levels = ['critical', 'high', 'medium', 'low'];

/**
 * Parse semver-like string into major/minor/patch numbers.
 *
 * @param {string} version - Version string.
 * @returns {{major: number, minor: number, patch: number} | null} Parsed version or null.
 */
function parseSemver(version) {
  const match = String(version).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Compare two parsed semantic versions.
 *
 * @param {{major: number, minor: number, patch: number}} left - Left-side version.
 * @param {{major: number, minor: number, patch: number}} right - Right-side version.
 * @returns {-1 | 0 | 1} Comparison result.
 */
function compareSemver(left, right) {
  if (left.major !== right.major) {
    return left.major > right.major ? 1 : -1;
  }
  if (left.minor !== right.minor) {
    return left.minor > right.minor ? 1 : -1;
  }
  if (left.patch !== right.patch) {
    return left.patch > right.patch ? 1 : -1;
  }
  return 0;
}

/**
 * Identify dependencies that are usually aligned by Expo SDK version policy.
 *
 * @param {string} packageName - Dependency package name.
 * @returns {boolean} True when package typically follows Expo SDK-managed cadence.
 */
function isExpoSdkManagedPackage(packageName) {
  return (
    packageName === 'expo' ||
    packageName.startsWith('expo-') ||
    packageName.startsWith('@expo/') ||
    packageName === 'react-native' ||
    packageName.startsWith('react-native-') ||
    packageName.startsWith('@react-native/')
  );
}

/**
 * Classify package update urgency.
 *
 * Critical is reserved for dependencies that can advance within declared constraints
 * but are still lagging by two or more major versions.
 *
 * Expo SDK-managed dependencies pinned by project constraints are down-scored to avoid
 * blocking pushes for expected SDK-bound lag.
 *
 * @param {{
 *   currentVersion: string,
 *   wantedVersion: string,
 *   latestVersion: string,
 *   isSdkManaged: boolean
 * }} input - Versioning and package policy metadata.
 * @returns {'critical' | 'high' | 'medium' | 'low'} Severity level.
 */
function classifyLevel({ currentVersion, wantedVersion, latestVersion, isSdkManaged }) {
  const current = parseSemver(currentVersion);
  const wanted = parseSemver(wantedVersion);
  const latest = parseSemver(latestVersion);

  if (!current || !latest) {
    return 'medium';
  }

  const comparison = compareSemver(current, latest);
  if (comparison >= 0) {
    return 'low';
  }

  const hasWanted = Boolean(wanted);
  const wantedComparison = hasWanted ? compareSemver(current, wanted) : 0;
  const pinnedByPolicy =
    hasWanted && compareSemver(current, wanted) === 0 && compareSemver(wanted, latest) < 0;

  if (pinnedByPolicy) {
    const majorGapToLatest = latest.major - current.major;
    if (majorGapToLatest >= 2) {
      return 'high';
    }
    if (majorGapToLatest === 1) {
      return 'medium';
    }
    if (latest.minor > current.minor) {
      return 'medium';
    }
    return 'low';
  }

  if (hasWanted && wantedComparison < 0) {
    const majorGapToWanted = wanted.major - current.major;
    if (majorGapToWanted >= 2) {
      return 'critical';
    }
    if (majorGapToWanted === 1) {
      return 'high';
    }
    if (wanted.minor > current.minor) {
      return 'medium';
    }
    return 'low';
  }

  const majorGapToLatest = latest.major - current.major;
  if (majorGapToLatest >= 2) {
    return isSdkManaged ? 'high' : 'critical';
  }
  if (majorGapToLatest === 1) {
    return 'high';
  }
  if (latest.minor > current.minor) {
    return 'medium';
  }
  return 'low';
}

/**
 * Build recommendation text for one outdated dependency.
 *
 * @param {{
 *   level: string,
 *   name: string,
 *   type: string,
 *   current: string,
 *   wanted: string,
 *   latest: string,
 *   isAheadOfLatest: boolean,
 *   isSdkManaged: boolean,
 *   pinnedByPolicy: boolean
 * }} dep - Dependency info.
 * @returns {string} Recommendation line.
 */
function buildRecommendation(dep) {
  if (dep.isAheadOfLatest) {
    return `Pinned prerelease is ahead of latest stable (${dep.current} vs ${dep.latest}). Keep as-is or downgrade intentionally after validation.`;
  }

  if (dep.pinnedByPolicy && dep.isSdkManaged) {
    return `Expo SDK-managed package pinned by current range (${dep.current} -> latest ${dep.latest}). Upgrade with SDK migration planning, not as a forced hot update.`;
  }

  const installCommand =
    dep.level === 'low' || dep.level === 'medium'
      ? `npm update ${dep.name}`
      : dep.type === 'devDependencies'
        ? `npm install --save-dev ${dep.name}@latest`
        : `npm install ${dep.name}@latest`;

  if (dep.level === 'critical') {
    return `MUST update before push (${dep.current} -> ${dep.latest}). Suggested: ${installCommand}`;
  }
  if (dep.level === 'high') {
    return `Strongly recommended update (${dep.current} -> ${dep.latest}). Suggested: ${installCommand}`;
  }
  if (dep.level === 'medium') {
    return `Recommended update soon (${dep.current} -> ${dep.latest}). Suggested: ${installCommand}`;
  }
  return `Low urgency patch update (${dep.current} -> ${dep.latest}). Suggested: ${installCommand}`;
}

const result = spawnSync('npm', ['outdated', '--json', '--long'], {
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'pipe'],
});

if (result.error) {
  console.error('[pre-push][deps-outdated] Failed to execute npm outdated.');
  console.error(String(result.error));
  process.exit(1);
}

if (![0, 1].includes(Number(result.status ?? 1))) {
  console.error('[pre-push][deps-outdated] npm outdated failed unexpectedly.');
  if (result.stderr) {
    console.error(String(result.stderr).trim());
  }
  process.exit(1);
}

const rawOutput = String(result.stdout ?? '').trim();
let outdatedMap = {};
if (rawOutput) {
  try {
    outdatedMap = JSON.parse(rawOutput);
  } catch (error) {
    console.error('[pre-push][deps-outdated] Could not parse npm outdated JSON output.');
    console.error(String(error));
    process.exit(1);
  }
}

const dependencies = Object.entries(outdatedMap).map(([name, info]) => {
  const current = String(info.current ?? 'unknown');
  const wanted = String(info.wanted ?? 'unknown');
  const latest = String(info.latest ?? 'unknown');
  const type = String(info.type ?? 'dependencies');
  const isSdkManaged = isExpoSdkManagedPackage(name);
  const currentParsed = parseSemver(current);
  const wantedParsed = parseSemver(wanted);
  const latestParsed = parseSemver(latest);
  const isAheadOfLatest =
    Boolean(currentParsed) &&
    Boolean(latestParsed) &&
    compareSemver(currentParsed, latestParsed) > 0;
  const pinnedByPolicy =
    Boolean(currentParsed) &&
    Boolean(wantedParsed) &&
    Boolean(latestParsed) &&
    compareSemver(currentParsed, wantedParsed) === 0 &&
    compareSemver(wantedParsed, latestParsed) < 0;
  const level = classifyLevel({
    currentVersion: current,
    wantedVersion: wanted,
    latestVersion: latest,
    isSdkManaged,
  });

  return {
    level,
    name,
    type,
    current,
    wanted,
    latest,
    isAheadOfLatest,
    isSdkManaged,
    pinnedByPolicy,
    recommendation: buildRecommendation({
      level,
      name,
      type,
      current,
      wanted,
      latest,
      isAheadOfLatest,
      isSdkManaged,
      pinnedByPolicy,
    }),
  };
});

const prereleaseAheadDependencies = dependencies.filter((dep) => dep.isAheadOfLatest);
const outdatedDependencies = dependencies.filter((dep) => !dep.isAheadOfLatest);

if (outdatedDependencies.length === 0) {
  console.warn('[pre-push][deps-outdated] No outdated dependencies detected.');

  if (prereleaseAheadDependencies.length > 0) {
    console.warn(
      `[pre-push][deps-outdated] ${prereleaseAheadDependencies.length} prerelease pin(s) are ahead of latest stable and kept as-is.`,
    );
    for (const dep of prereleaseAheadDependencies) {
      console.warn(
        `- [INFO] ${dep.name} (${dep.type}) current ${dep.current} vs latest stable ${dep.latest}`,
      );
    }
  }

  process.exit(0);
}

outdatedDependencies.sort((a, b) => {
  const byLevel = levels.indexOf(a.level) - levels.indexOf(b.level);
  return byLevel !== 0 ? byLevel : a.name.localeCompare(b.name);
});

const summary = levels.reduce(
  (acc, level) => {
    acc[level] = outdatedDependencies.filter((dep) => dep.level === level).length;
    return acc;
  },
  { critical: 0, high: 0, medium: 0, low: 0 },
);

console.warn('[pre-push][deps-outdated] Outdated dependencies detected.');
console.warn(
  `[pre-push][deps-outdated] Scale summary: critical=${summary.critical}, high=${summary.high}, ` +
    `medium=${summary.medium}, low=${summary.low}.`,
);

for (const dep of outdatedDependencies) {
  console.warn(
    `- [${dep.level.toUpperCase()}] ${dep.name} (${dep.type}) ` +
      `${dep.current} -> wanted ${dep.wanted} -> latest ${dep.latest}`,
  );
  console.warn(`  Recommendation: ${dep.recommendation}`);
}

if (prereleaseAheadDependencies.length > 0) {
  console.warn(
    `[pre-push][deps-outdated] ${prereleaseAheadDependencies.length} prerelease pin(s) are ahead of latest stable and excluded from obsolescence scoring.`,
  );
}

if (summary.critical > 0) {
  console.error('[pre-push][deps-outdated] Critical obsolescence found. Push blocked.');
  process.exit(1);
}

console.warn(
  '[pre-push][deps-outdated] No critical obsolescence found. Stage passed with recommendations.',
);
