/**
 * Ambient type declarations for peer dependencies
 */

declare module 'react-native' {
  export const NativeModules: {
    SourceCode: {
      getConstants(): { scriptURL: string };
      scriptURL?: string;
    };
    [key: string]: unknown;
  };

  export const Platform: {
    OS: 'ios' | 'android' | 'web' | 'windows' | 'macos';
    Version: number | string;
    select<T>(config: { ios?: T; android?: T; default?: T }): T;
  };

  export class NativeEventEmitter {
    constructor(nativeModule?: unknown);
    addListener(
      eventName: string,
      listener: (event: unknown) => void
    ): EmitterSubscription;
    removeAllListeners(eventName: string): void;
  }

  export interface EmitterSubscription {
    remove(): void;
  }

  export const TurboModuleRegistry: {
    getEnforcing<T>(moduleName: string): T;
    get<T>(moduleName: string): T | null;
  };
}

declare module 'react-native/Libraries/Core/InitializeCore.js' {
  // Empty module - just needs to be imported for side effects
}

declare module 'chalk' {
  interface ChalkInstance {
    (text: string): string;
    bold: ChalkInstance;
    dim: ChalkInstance;
    italic: ChalkInstance;
    underline: ChalkInstance;
    inverse: ChalkInstance;
    strikethrough: ChalkInstance;
    red: ChalkInstance;
    green: ChalkInstance;
    blue: ChalkInstance;
    yellow: ChalkInstance;
    cyan: ChalkInstance;
    magenta: ChalkInstance;
    white: ChalkInstance;
    gray: ChalkInstance;
    grey: ChalkInstance;
    black: ChalkInstance;
    bgRed: ChalkInstance;
    bgGreen: ChalkInstance;
    bgBlue: ChalkInstance;
    bgYellow: ChalkInstance;
    bgCyan: ChalkInstance;
    bgMagenta: ChalkInstance;
    bgWhite: ChalkInstance;
  }
  const chalk: ChalkInstance;
  export default chalk;
}

declare module 'metro' {
  interface MetroConfig {
    [key: string]: unknown;
  }
  
  interface ServerOptions {
    host?: string;
    secure?: boolean;
    secureCert?: string;
    secureKey?: string;
    unstable_extraMiddleware?: unknown[];
    websocketEndpoints?: Record<string, unknown>;
  }

  interface MetroServer {
    keepAliveTimeout: number;
  }

  function runServer(config: MetroConfig, options: ServerOptions): Promise<MetroServer>;
  
  const TerminalReporter: new (terminal: unknown) => { update: (event: unknown) => void } | undefined;
  
  export { runServer, TerminalReporter };
  export default { runServer, TerminalReporter };
}

declare module 'metro-core' {
  export class Terminal {
    constructor(stream: NodeJS.WriteStream);
  }
}

declare module 'metro-config' {
  interface ProjectConfig {
    isEmpty: boolean;
    filepath: string;
  }
  
  function loadConfig(options: { cwd: string; [key: string]: unknown }): Promise<Record<string, unknown>>;
  function mergeConfig(...configs: Record<string, unknown>[]): Record<string, unknown>;
  function resolveConfig(configPath: string | undefined, cwd: string): Promise<ProjectConfig>;
  
  export { loadConfig, mergeConfig, resolveConfig };
}

declare module 'metro-resolver' {
  interface ResolutionContext {
    resolveRequest: (
      context: ResolutionContext,
      moduleName: string,
      platform: string | null
    ) => Resolution;
  }

  interface Resolution {
    filePath: string;
    type: 'sourceFile' | 'assetFiles' | 'empty';
  }

  function resolve(
    context: ResolutionContext,
    moduleName: string,
    platform: string | null
  ): Resolution;
  
  export { resolve, ResolutionContext, Resolution };
}

declare module '@react-native/dev-middleware' {
  interface DevMiddlewareOptions {
    projectRoot: string;
    serverBaseUrl: string;
    logger: unknown;
    unstable_experiments?: {
      enableNetworkInspector?: boolean;
    };
    unstable_customInspectorMessageHandler?: unknown;
  }

  interface DevMiddlewareResult {
    middleware: unknown;
    websocketEndpoints: Record<string, unknown>;
  }

  function createDevMiddleware(options: DevMiddlewareOptions): DevMiddlewareResult;
  
  export { createDevMiddleware };
}

declare module 'debug' {
  function debug(namespace: string): (...args: unknown[]) => void;
  export = debug;
}

declare module 'semver' {
  function gt(v1: string, v2: string): boolean;
  function compare(v1: string | null, v2: string | null): number;
  function coerce(version: string): { version: string } | null;
  
  export { gt, compare, coerce };
  export default { gt, compare, coerce };
}
