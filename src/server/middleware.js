/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall react_native
 */

const debug = require('debug')('ReactNative:CommunityCliPlugin');

const unusedStubWSServer = {};
const unusedMiddlewareStub = {};

const communityMiddlewareFallback = {
  createDevServerMiddleware: (params) => ({
    // FIXME: Several features will break without community middleware and
    // should be migrated into core.
    // e.g. used by Libraries/Core/Devtools:
    // - /open-stack-frame
    // - /open-url
    // - /symbolicate
    middleware: unusedMiddlewareStub,
    websocketEndpoints: {},
    messageSocketEndpoint: {
      server: unusedStubWSServer,
      broadcast: (method, _params) => {},
    },
    eventsSocketEndpoint: {
      server: unusedStubWSServer,
      reportEvent: (event) => {},
    },
  }),
};

// Attempt to use the community middleware if it exists, but fallback to
// the stubs if it doesn't.
try {
  // `@react-native-community/cli` is an optional peer dependency of this
  // package, and should be a dev dependency of the host project (via the
  // community template's package.json).
  const communityCliPath = require.resolve('@react-native-community/cli');

  // Until https://github.com/react-native-community/cli/pull/2605 lands,
  // we need to find `@react-native-community/cli-server-api` via
  // `@react-native-community/cli`. Once that lands, we can simply
  // require('@react-native-community/cli').
  const communityCliServerApiPath = require.resolve(
    '@react-native-community/cli-server-api',
    { paths: [communityCliPath] },
  );
  communityMiddlewareFallback.createDevServerMiddleware = require(
    communityCliServerApiPath,
  ).createDevServerMiddleware;
} catch {
  debug(`⚠️ Unable to find @react-native-community/cli-server-api
Starting the server without the community middleware.`);
}

export const createDevServerMiddleware =
  communityMiddlewareFallback.createDevServerMiddleware;
