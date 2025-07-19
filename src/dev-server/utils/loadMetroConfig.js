/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall react_native
 */

import { CLIError } from './errors';
import { reactNativePlatformResolver } from './metroPlatformResolver';
import { loadConfig, mergeConfig, resolveConfig } from 'metro-config';
import path from 'path';

const debug = require('debug')('ReactNative:CommunityCliPlugin');

/**
 * Get the config options to override based on RN CLI inputs.
 * @param {object} ctx The configuration loading context.
 * @param {object} config The default Metro configuration.
 * @returns {object} A partial Metro configuration object with overrides.
 */
function getOverrideConfig(ctx, config) {
  const outOfTreePlatforms = Object.keys(ctx.platforms).filter(
    platform => ctx.platforms[platform].npmPackageName,
  );
  const resolver = {
    platforms: [...Object.keys(ctx.platforms), 'native'],
  };

  if (outOfTreePlatforms.length) {
    resolver.resolveRequest = reactNativePlatformResolver(
      outOfTreePlatforms.reduce((result, platform) => {
        result[platform] = ctx.platforms[platform].npmPackageName;
        return result;
      }, {}),
      config.resolver?.resolveRequest,
    );
  }

  return {
    resolver,
    serializer: {
      // We can include multiple copies of InitializeCore here because metro will
      // only add ones that are already part of the bundle
      getModulesRunBeforeMainModule: () => [
        require.resolve(
          path.join(ctx.reactNativePath, 'Libraries/Core/InitializeCore'),
          { paths: [ctx.root] },
        ),
        ...outOfTreePlatforms.map(platform =>
          require.resolve(
            `${ctx.platforms[platform].npmPackageName}/Libraries/Core/InitializeCore`,
            { paths: [ctx.root] },
          ),
        ),
      ],
    },
  };
}

/**
 * Load Metro config.
 *
 * Allows the CLI to override select values in `metro.config.js` based on
 * dynamic user options in `ctx`.
 * @param {object} ctx The configuration loading context.
 * @param {object} [options={}] Options from Yargs.
 * @returns {Promise<object>} The loaded Metro configuration.
 */
export default async function loadMetroConfig(ctx, options = {}) {
  const cwd = ctx.root;
  const projectConfig = await resolveConfig(options.config, cwd);

  if (projectConfig.isEmpty) {
    throw new CLIError(`No Metro config found in ${cwd}`);
  }

  debug(`Reading Metro config from ${projectConfig.filepath}`);

  if (!global.__REACT_NATIVE_METRO_CONFIG_LOADED) {
    const warning = `
=================================================================================================
From React Native 0.73, your project's Metro config should extend '@react-native/metro-config'
or it will fail to build. Please copy the template at:
https://github.com/react-native-community/template/blob/main/template/metro.config.js
This warning will be removed in future (https://github.com/facebook/metro/issues/1018).
=================================================================================================
    `;

    for (const line of warning.trim().split('\n')) {
      console.warn(line);
    }
  }

  const config = await loadConfig({
    cwd,
    ...options,
  });

  const overrideConfig = getOverrideConfig(ctx, config);

  return mergeConfig(config, overrideConfig);
}
