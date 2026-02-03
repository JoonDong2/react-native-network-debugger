/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall react_native
 */

import createDevMiddlewareLogger from "./utils/createDevMiddlewareLogger";
import isDevServerRunning from "./utils/isDevServerRunning";
import loadMetroConfig from "./utils/loadMetroConfig";
import * as version from "./utils/version";
import attachKeyHandlers from "./attachKeyHandlers";
import { createDevServerMiddleware } from "./middleware";
import { createDevMiddleware } from "@react-native/dev-middleware";
import chalk from "chalk";
import Metro from "metro";
import { Terminal } from "metro-core";
import path from "path";
import url from "url";
import InspectorMessageHandler from "./InspectorMessageHandler";
import { DEVICE_KEY } from "../shared/constants";
import { resolve as defaultResolve } from "metro-resolver";
import JSAppProxy from "./JSAppProxy";

async function runServer(_argv, cliConfig, args) {
  const metroConfig = await loadMetroConfig(cliConfig, {
    config: args.config,
    maxWorkers: args.maxWorkers,
    port: args.port,
    resetCache: args.resetCache,
    watchFolders: args.watchFolders,
    projectRoot: args.projectRoot,
    sourceExts: args.sourceExts,
  });
  const hostname = args.host?.length ? args.host : "localhost";
  const {
    projectRoot,
    server: { port },
    watchFolders,
  } = metroConfig;
  const protocol = args.https === true ? "https" : "http";
  const devServerUrl = url.format({ protocol, hostname, port });

  const originalResolveRequest =
    metroConfig.resolver?.resolveRequest ?? defaultResolve;
  metroConfig.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "../Core/InitializeCore") {
      return {
        filePath: require.resolve("react-native-network-debugger/client"),
        type: "sourceFile",
      };
    }
    return originalResolveRequest(context, moduleName, platform);
  };

  console.info(
    chalk.blue(`\nWelcome to React Native v${cliConfig.reactNativeVersion}`)
  );

  const serverStatus = await isDevServerRunning(devServerUrl, projectRoot);

  if (serverStatus === "matched_server_running") {
    console.info(
      `A dev server is already running for this project on port ${port}. Exiting.`
    );
    return;
  } else if (serverStatus === "port_taken") {
    console.error(
      `${chalk.red(
        "error"
      )}: Another process is running on port ${port}. Please terminate this ` +
        'process and try again, or use another port with "--port".'
    );
    return;
  }

  console.info(`Starting dev server on ${devServerUrl}\n`);

  if (args.assetPlugins) {
    metroConfig.transformer.assetPlugins = args.assetPlugins.map((plugin) =>
      require.resolve(plugin)
    );
  }
  // TODO(T214991636): Remove legacy Metro log forwarding
  if (!args.clientLogs) {
    metroConfig.server.forwardClientLogs = false;
  }

  let reportEvent;
  const terminal = new Terminal(process.stdout);
  const ReporterImpl = getReporterImpl(args.customLogReporterPath);
  const terminalReporter = new ReporterImpl(terminal);

  const {
    middleware: communityMiddleware,
    websocketEndpoints: communityWebsocketEndpoints,
    messageSocketEndpoint,
    eventsSocketEndpoint,
  } = createDevServerMiddleware({
    host: hostname,
    port,
    watchFolders,
  });
  const { middleware, websocketEndpoints } = createDevMiddleware({
    projectRoot,
    serverBaseUrl: devServerUrl,
    logger: createDevMiddlewareLogger(terminalReporter),
    unstable_experiments: {
      enableNetworkInspector: true,
    },
    unstable_customInspectorMessageHandler:
      InspectorMessageHandler.createInspectorMessageHandler,
  });

  const reporter = {
    update(event) {
      // Passes only non-debugging logs.
      if (!Array.isArray(event.data) || event.data[0] !== DEVICE_KEY) {
        terminalReporter.update(event);
      }

      if (reportEvent) {
        reportEvent(event);
      }
      if (args.interactive && event.type === "initialize_done") {
        terminalReporter.update({
          type: "unstable_server_log",
          level: "info",
          data: `Dev server ready. ${chalk.dim("Press Ctrl+C to exit.")}`,
        });
        attachKeyHandlers({
          devServerUrl,
          messageSocket: messageSocketEndpoint,
          reporter: terminalReporter,
        });
      }
    },
  };
  metroConfig.reporter = reporter;

  const jsAppMiddlewareEndpoint = JSAppProxy.createJSAppMiddleware();

  const serverInstance = await Metro.runServer(metroConfig, {
    host: args.host,
    secure: args.https,
    secureCert: args.cert,
    secureKey: args.key,
    unstable_extraMiddleware: [communityMiddleware, middleware],
    websocketEndpoints: {
      ...communityWebsocketEndpoints,
      ...websocketEndpoints,
      ...jsAppMiddlewareEndpoint,
    },
  });

  reportEvent = eventsSocketEndpoint.reportEvent;

  // In Node 8, the default keep-alive for an HTTP connection is 5 seconds. In
  // early versions of Node 8, this was implemented in a buggy way which caused
  // some HTTP responses (like those containing large JS bundles) to be
  // terminated early.
  //
  // As a workaround, arbitrarily increase the keep-alive from 5 to 30 seconds,
  // which should be enough to send even the largest of JS bundles.
  //
  // For more info: https://github.com/nodejs/node/issues/13391
  //
  serverInstance.keepAliveTimeout = 30000;

  await version.logIfUpdateAvailable(cliConfig, terminalReporter);
}

function getReporterImpl(customLogReporterPath) {
  if (customLogReporterPath == null) {
    // Try the new Metro >= 0.83 API first
    try {
      const metro = require("metro");
      if (metro.TerminalReporter != null) {
        return metro.TerminalReporter;
      }
    } catch {
      // Ignore if metro package itself fails to load
    }

    // Fallback to legacy path for Metro < 0.83
    try {
      return require("metro/src/lib/TerminalReporter");
    } catch (e) {
      throw new Error(
        "Unable to find TerminalReporter in metro package. " +
          "Please ensure you have a compatible version of Metro installed (>= 0.83 recommended)."
      );
    }
  }
  try {
    // First we let require resolve it, so we can require packages in node_modules
    // as expected. eg: require('my-package/reporter');
    return require(customLogReporterPath);
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code !== "MODULE_NOT_FOUND") {
      throw e;
    }
    // If that doesn't work, then we next try relative to the cwd, eg:
    // require('./reporter');
    return require(path.resolve(customLogReporterPath));
  }
}

export default runServer;
