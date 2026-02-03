/**
 * @file Checks for available React Native updates and logs a message if a new version is found.
 * @copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import semver from 'semver';
import { styleText } from 'util';
import type { TerminalReporter } from '../../types/metro';

const debug = require('debug')('ReactNative:CommunityCliPlugin');

interface CLIVersionConfig {
  reactNativeVersion: string;
}

interface VersionInfo {
  stable: string;
  candidate?: string;
  changelogUrl: string;
  diffUrl: string;
}

interface LatestVersion {
  stable: string;
  candidate?: string;
}

/**
 * Logs out a message if the user's version is behind a stable version of React Native.
 */
export async function logIfUpdateAvailable(
  cliConfig: CLIVersionConfig,
  reporter: TerminalReporter
): Promise<void> {
  const { reactNativeVersion: currentVersion } = cliConfig;
  let newVersion: VersionInfo | null = null;

  try {
    const upgrade = await getLatestRelease(currentVersion);

    if (upgrade) {
      newVersion = upgrade;
    }
  } catch (e) {
    // We let the flow continue as this component is not vital for the rest of
    // the CLI.
    debug(
      'Cannot detect current version of React Native, ' +
        'skipping check for a newer release'
    );
    debug(e);
  }

  if (newVersion == null) {
    return;
  }

  if (semver.gt(newVersion.stable, currentVersion)) {
    reporter.update({
      type: 'unstable_server_log',
      level: 'info',
      data: `React Native v${newVersion.stable} is now available (your project is running on v${currentVersion}).
Changelog: ${styleText(['dim', 'underline'], newVersion?.changelogUrl ?? 'none')}
Diff: ${styleText(['dim', 'underline'], newVersion?.diffUrl ?? 'none')}
`,
    });
  }
}

/**
 * Checks via GitHub API if there is a newer stable React Native release and,
 * if it exists, returns the release data.
 *
 * If the latest release is not newer or if it's a prerelease, the function
 * will return undefined.
 */
export default async function getLatestRelease(
  currentVersion: string
): Promise<VersionInfo | undefined> {
  debug('Checking for a newer version of React Native');
  try {
    debug(`Current version: ${currentVersion}`);

    // if the version is a nightly/canary build, we want to bail
    // since they are nightlies or unreleased versions
    if (['-canary', '-nightly'].some((s) => currentVersion.includes(s))) {
      return;
    }

    debug('Checking for newer releases on GitHub');
    const latestVersion = await getLatestRnDiffPurgeVersion();
    if (latestVersion == null) {
      debug('Failed to get latest release');
      return;
    }
    const { stable, candidate } = latestVersion;
    debug(`Latest release: ${stable} (candidate: ${candidate ?? 'none'})`);

    // Compare clean versions to avoid issues with prerelease tags
    const coercedStable = semver.coerce(stable);
    const coercedCurrent = semver.coerce(currentVersion);
    if (coercedStable && coercedCurrent && semver.compare(coercedStable.version, coercedCurrent.version) >= 0) {
      return {
        stable,
        candidate,
        changelogUrl: buildChangelogUrl(stable),
        diffUrl: buildDiffUrl(currentVersion, stable),
      };
    }
  } catch (e) {
    debug('Something went wrong with remote version checking, moving on');
    debug(e);
  }
}

/**
 * Constructs a changelog URL for a given version.
 */
function buildChangelogUrl(version: string): string {
  return `https://github.com/facebook/react-native/releases/tag/v${version}`;
}

/**
 * Constructs a URL to the upgrade-helper diff page.
 */
function buildDiffUrl(oldVersion: string, newVersion: string): string {
  return `https://react-native-community.github.io/upgrade-helper/?from=${oldVersion}&to=${newVersion}`;
}

interface GitHubTag {
  name: string;
}

/**
 * Fetches tags from the rn-diff-purge repository and returns the most recent
 * stable and candidate React Native versions available.
 */
async function getLatestRnDiffPurgeVersion(): Promise<LatestVersion | undefined> {
  const options = {
    // https://developer.github.com/v3/#user-agent-required
    headers: { 'User-Agent': '@react-native/community-cli-plugin' },
  };

  const resp = await fetch(
    'https://api.github.com/repos/react-native-community/rn-diff-purge/tags',
    options
  );

  if (resp.status !== 200) {
    debug(`Failed to fetch tags, status code: ${resp.status}`);
    return;
  }

  const result: LatestVersion = { stable: '0.0.0' };

  // Filter for valid tag objects that have a name property.
  const body = ((await resp.json()) as GitHubTag[]).filter(
    (tag) => tag && typeof tag.name === 'string'
  );

  // The GitHub API returns tags in reverse chronological order (latest first).
  for (const { name: versionTag } of body) {
    // Tag format is `rn-vX.Y.Z` or `rn-vX.Y.Z-rc.W`
    if (!versionTag.startsWith('rn-v')) {
      continue;
    }
    const versionNumber = versionTag.substring(4); // Remove "rn-v" prefix

    // Capture the first (latest) release candidate we find.
    if (result.candidate == null && versionNumber.includes('-rc')) {
      result.candidate = versionNumber;
      continue;
    }

    // Capture the first (latest) stable release and exit.
    if (!versionNumber.includes('-rc')) {
      result.stable = versionNumber;
      return result;
    }
  }
  return result;
}
