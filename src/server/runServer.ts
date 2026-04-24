/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall react_native
 */

import createDevMiddlewareLogger from './utils/createDevMiddlewareLogger';
import isDevServerRunning from './utils/isDevServerRunning';
import loadMetroConfig from './utils/loadMetroConfig';
import * as version from './utils/version';
import { isRNGte083Server } from './utils/rnVersion';
import attachKeyHandlers from './attachKeyHandlers';
import { createDevServerMiddleware } from './middleware';
import chalk from 'chalk';
import path from 'path';
import url from 'url';
import InspectorMessageHandler from './InspectorMessageHandler';
import { DEVICE_KEY } from '../shared/constants';
import JSAppProxy from './JSAppProxy';
import { resolveConsumerFrontendDist, preparePatchedFrontend } from './utils/patchDebuggerFrontend';
import type MetroModule from 'metro';
import type { Terminal as TerminalType } from 'metro-core';
import type { CLIConfig, ServerArgs, TerminalReporter, ResolverContext, Resolution } from '../types/metro';

// Metro, metro-core, @react-native/dev-middleware는 반드시 컨슈머(char-app)의 node_modules에서
// 로드해야 한다. 그렇지 않으면 metro-resolver가 두 인스턴스로 로드돼 사용자 customResolver의
// require('metro-resolver').resolve와 Metro 내부 resolve가 서로 다른 참조가 되어 무한 재귀가 발생한다.
function requireFromProject<T>(name: string): T {
  const resolved = require.resolve(name, { paths: [process.cwd()] });
  return require(resolved) as T;
}

type CreateDevMiddleware = typeof import('@react-native/dev-middleware').createDevMiddleware;

interface MetroConfig {
  projectRoot: string;
  server: {
    port: number;
    forwardClientLogs?: boolean;
  };
  watchFolders: readonly string[];
  resolver?: {
    resolveRequest?: (
      context: ResolverContext,
      moduleName: string,
      platform: string | null
    ) => Resolution;
  };
  transformer?: {
    assetPlugins?: string[];
  };
  reporter?: {
    update: (event: unknown) => void;
  };
  [key: string]: unknown;
}

interface MetroServer {
  keepAliveTimeout: number;
}

interface ReporterClass {
  new (terminal: TerminalType): TerminalReporter;
}

async function runServer(
  _argv: string[],
  cliConfig: CLIConfig,
  args: ServerArgs
): Promise<void> {
  const Metro = requireFromProject<typeof MetroModule>('metro');
  const { Terminal } = requireFromProject<{ Terminal: typeof TerminalType }>('metro-core');

  const metroConfig = (await loadMetroConfig(cliConfig, {
    config: args.config,
    maxWorkers: args.maxWorkers,
    port: args.port,
    resetCache: args.resetCache,
    watchFolders: args.watchFolders,
    projectRoot: args.projectRoot,
    sourceExts: args.sourceExts,
  })) as MetroConfig;

  const hostname = args.host?.length ? args.host : 'localhost';
  const {
    projectRoot,
    server: { port },
    watchFolders,
  } = metroConfig;
  const protocol = args.https === true ? 'https' : 'http';
  const devServerUrl = url.format({ protocol, hostname, port });

  // 기존 사용자 resolver를 보존하면서 `../Core/InitializeCore` 상대 경로만 client로 교체한다.
  // React 렌더러가 ReactNativePrivateInitializeCore를 통해 상대 경로로 InitializeCore를 import하므로
  // 이 경로를 가로채 client 번들을 로드하면 앱 시작 시점에 CDP 훅이 설치된다.
  const prevResolveRequest = metroConfig.resolver?.resolveRequest;
  const clientPath = require.resolve('react-native-network-debugger/client', {
    paths: [process.cwd()],
  });
  // client 번들은 library node_modules 밖에서 import 되지만, react-native peer dep은
  // 반드시 컨슈머 설치본을 써야 한다. (library node_modules에 버전이 다른 react-native가
  // 남아 있을 수 있고, 그 경우 native 모듈과 JS 모듈 인스턴스가 어긋나 self 폴리필 같은
  // 전역 상태가 분리되어 runtime 에러가 발생한다.)
  const libraryDir = path.dirname(path.dirname(clientPath));
  function resolveFromConsumer(moduleName: string): Resolution {
    const resolved = require.resolve(moduleName, { paths: [process.cwd()] });
    return { filePath: resolved, type: 'sourceFile' };
  }
  function isBareModule(name: string): boolean {
    return (
      !name.startsWith('.') &&
      !name.startsWith('/') &&
      !name.startsWith('\0') // rollup virtual
    );
  }
  metroConfig.resolver = metroConfig.resolver || {};
  metroConfig.resolver.resolveRequest = (
    context: ResolverContext,
    moduleName: string,
    platform: string | null
  ): Resolution => {
    if (moduleName === '../Core/InitializeCore') {
      return { filePath: clientPath, type: 'sourceFile' };
    }
    // client 번들 내부의 bare import는 컨슈머 node_modules 기준으로 해석한다.
    const origin = context.originModulePath;
    if (origin && origin.startsWith(libraryDir) && isBareModule(moduleName)) {
      try {
        return resolveFromConsumer(moduleName);
      } catch {
        // fallthrough to default resolver
      }
    }
    if (prevResolveRequest) {
      return prevResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };

  console.info(
    chalk.blue(`\nWelcome to React Native v${cliConfig.reactNativeVersion}`)
  );

  const serverStatus = await isDevServerRunning(devServerUrl, projectRoot);

  if (serverStatus === 'matched_server_running') {
    console.info(
      `A dev server is already running for this project on port ${port}. Exiting.`
    );
    return;
  } else if (serverStatus === 'port_taken') {
    console.error(
      `${chalk.red(
        'error'
      )}: Another process is running on port ${port}. Please terminate this ` +
        'process and try again, or use another port with "--port".'
    );
    return;
  }

  console.info(`Starting dev server on ${devServerUrl}\n`);

  if (args.assetPlugins) {
    metroConfig.transformer = metroConfig.transformer || {};
    metroConfig.transformer.assetPlugins = args.assetPlugins.map((plugin) =>
      require.resolve(plugin)
    );
  }
  // TODO(T214991636): Remove legacy Metro log forwarding
  if (!args.clientLogs) {
    metroConfig.server.forwardClientLogs = false;
  }

  let reportEvent: ((event: unknown) => void) | undefined;
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

  // RN 0.83+ 전용 커스텀 debugger-frontend(WS 필터 주입본)를 환경변수로 주입.
  // @react-native/debugger-frontend의 index.js가 REACT_NATIVE_DEBUGGER_FRONTEND_PATH를 우선 사용한다.
  if (isRNGte083Server(cliConfig.reactNativeVersion)) {
    // 소비 프로젝트의 @react-native/debugger-frontend를 런타임에 참조해 패치 적용.
    // 패치 실패 시에는 env var를 세팅하지 않아 dev-middleware가 원본 consumer frontend를
    // 그대로 쓰도록 둔다. (라이브러리 번들 assets는 0.83.4 고정이라 소비 프로젝트의
    // RN 버전과 어긋나면 CDP/UX 불일치를 유발하므로 fallback에서 제외한다.
    // Socket 필터는 잃지만 디버거 본체는 네이티브와 버전 정합성이 유지된다.)
    const consumer = resolveConsumerFrontendDist();
    let frontendPath: string | null = null;
    if (consumer) {
      console.info(chalk.dim(`[network-debugger] debugger-frontend v${consumer.version} (consumer)`));
      frontendPath = preparePatchedFrontend(consumer.dist);
      if (!frontendPath) {
        console.warn(
          chalk.yellow(
            `[network-debugger] WebSocket 필터 주입 실패 (debugger-frontend v${consumer.version}). ` +
              '원본 frontend를 그대로 사용합니다.'
          )
        );
      }
    }

    if (frontendPath) {
      process.env.REACT_NATIVE_DEBUGGER_FRONTEND_PATH = frontendPath;
      // RN 0.85+에서는 react-native/react-native.config.js가 CLI config 로드 시점에
      // @react-native/community-cli-plugin을 eager require한다. 이게 @react-native/dev-middleware
      // → @react-native/debugger-frontend 체인을 env 세팅 전에 로드해버리므로, debugger-frontend의
      // frontEndPath가 default로 고정된 채 module.exports에 캐시된다. 이 상태에서 dev-middleware를
      // 다시 require해도 같은 캐시 객체를 돌려받아 커스텀 frontend 경로가 반영되지 않는다.
      // → env var 세팅 후 관련 모듈 캐시를 비워 fresh하게 재로딩한다.
      // 내부 상대 경로 모듈(createDevMiddleware.js 등)도 자체 캐시를 가지므로 패키지 내부
      // 모든 캐시 엔트리를 비워야 한다. 단순히 entry point만 비우면 내부 require가 여전히
      // 오래된 debugger-frontend export 참조를 들고 있어 env var가 반영되지 않는다.
      const purgePackageCache = (name: string): void => {
        try {
          const pkgJsonPath = require.resolve(`${name}/package.json`, {
            paths: [process.cwd()],
          });
          const pkgDir = path.dirname(pkgJsonPath);
          for (const key of Object.keys(require.cache)) {
            if (key.startsWith(pkgDir + path.sep) || key === pkgDir) {
              delete require.cache[key];
            }
          }
        } catch {
          // ignore
        }
      };
      purgePackageCache('@react-native/debugger-frontend');
      purgePackageCache('@react-native/dev-middleware');
    }
  }

  // dev-middleware를 env 설정 이후에 lazy require 하여 커스텀 frontend 경로가 반영되게 한다.
  // 컨슈머 프로젝트의 node_modules에서 로드한다.
  const { createDevMiddleware } = requireFromProject<{
    createDevMiddleware: CreateDevMiddleware;
  }>('@react-native/dev-middleware');

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
    update(event: { type: string; data?: unknown[] }): void {
      // Passes only non-debugging logs.
      if (!Array.isArray(event.data) || event.data[0] !== DEVICE_KEY) {
        terminalReporter.update(event);
      }

      if (reportEvent) {
        reportEvent(event);
      }
      if (args.interactive && event.type === 'initialize_done') {
        terminalReporter.update({
          type: 'unstable_server_log',
          level: 'info',
          data: `Dev server ready. ${chalk.dim('Press Ctrl+C to exit.')}`,
        });
        attachKeyHandlers({
          devServerUrl,
          messageSocket: messageSocketEndpoint,
          reporter: terminalReporter,
        });
      }
    },
  };
  metroConfig.reporter = reporter as MetroConfig['reporter'];

  const jsAppMiddlewareEndpoint = JSAppProxy.createJSAppMiddleware();

  const serverInstance = (await Metro.runServer(metroConfig, {
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
  })) as MetroServer;

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

function getReporterImpl(customLogReporterPath?: string): ReporterClass {
  if (customLogReporterPath == null) {
    // Try the new Metro >= 0.83 API first, loading from the consumer project.
    try {
      const metro = requireFromProject<{ TerminalReporter?: ReporterClass }>('metro');
      if (metro.TerminalReporter != null) {
        return metro.TerminalReporter;
      }
    } catch {
      // Ignore if metro package itself fails to load
    }

    // Fallback to legacy path for Metro < 0.83
    try {
      const legacyPath = require.resolve('metro/src/lib/TerminalReporter', {
        paths: [process.cwd()],
      });
      return require(legacyPath) as ReporterClass;
    } catch {
      throw new Error(
        'Unable to find TerminalReporter in metro package. ' +
          'Please ensure you have a compatible version of Metro installed (>= 0.83 recommended).'
      );
    }
  }
  try {
    // First we let require resolve it, so we can require packages in node_modules
    // as expected. eg: require('my-package/reporter');
    return require(customLogReporterPath) as ReporterClass;
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
    // If that doesn't work, then we next try relative to the cwd, eg:
    // require('./reporter');
    return require(path.resolve(customLogReporterPath)) as ReporterClass;
  }
}

export default runServer;
