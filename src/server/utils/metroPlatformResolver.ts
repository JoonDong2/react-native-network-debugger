/**
 * @file Implements a Metro resolver to remap 'react-native' imports based on the target platform.
 * @copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ResolverContext, Resolution, ResolveRequest } from '../../types/metro';

/**
 * This is an implementation of a metro resolveRequest option which will remap react-native imports
 * to different npm packages based on the platform requested. This allows a single metro instance/config
 * to produce bundles for multiple out-of-tree platforms at a time.
 *
 * @param platformImplementations A map of platform to npm package that implements that platform.
 * @param customResolver An optional custom resolver function to chain to.
 * @returns A Metro custom resolver.
 */
export function reactNativePlatformResolver(
  platformImplementations: Record<string, string>,
  customResolver?: ResolveRequest
): ResolveRequest {
  return (
    context: ResolverContext,
    moduleName: string,
    platform: string | null
  ): Resolution => {
    let modifiedModuleName = moduleName;
    if (platform != null && platformImplementations[platform]) {
      if (moduleName === 'react-native') {
        modifiedModuleName = platformImplementations[platform];
      } else if (moduleName.startsWith('react-native/')) {
        modifiedModuleName = `${
          platformImplementations[platform]
        }/${modifiedModuleName.slice('react-native/'.length)}`;
      }
    }

    // If a custom resolver is provided, use it. Otherwise, fallback to the default resolver.
    if (customResolver) {
      return customResolver(context, modifiedModuleName, platform);
    }
    return context.resolveRequest(context, modifiedModuleName, platform);
  };
}
