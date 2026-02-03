/**
 * Metro and React Native CLI types
 */

/**
 * Metro configuration options
 */
export interface MetroConfigOptions {
  config?: string;
  maxWorkers?: number;
  port?: number;
  resetCache?: boolean;
  watchFolders?: string[];
  projectRoot?: string;
  sourceExts?: string[];
}

/**
 * CLI configuration
 */
export interface CLIConfig {
  root: string;
  reactNativePath: string;
  reactNativeVersion: string;
  platforms: Record<string, PlatformConfig>;
}

/**
 * Platform configuration
 */
export interface PlatformConfig {
  npmPackageName?: string;
}

/**
 * Server arguments from CLI
 */
export interface ServerArgs {
  port?: number;
  host?: string;
  projectRoot?: string;
  watchFolders?: string[];
  assetPlugins?: string[];
  sourceExts?: string[];
  maxWorkers?: number;
  transformer?: string;
  resetCache?: boolean;
  customLogReporterPath?: string;
  https?: boolean;
  key?: string;
  cert?: string;
  config?: string;
  interactive?: boolean;
  clientLogs?: boolean;
}

/**
 * Metro resolver context
 */
export interface ResolverContext {
  resolveRequest: (
    context: ResolverContext,
    moduleName: string,
    platform: string | null
  ) => Resolution;
}

/**
 * Metro resolution result
 */
export interface Resolution {
  filePath: string;
  type: 'sourceFile' | 'assetFiles' | 'empty';
}

/**
 * Metro resolver function
 */
export type ResolveRequest = (
  context: ResolverContext,
  moduleName: string,
  platform: string | null
) => Resolution;

/**
 * Reporter event
 */
export interface ReporterEvent {
  type: string;
  level?: 'info' | 'warn' | 'error';
  data?: unknown;
  message?: string;
}

/**
 * Terminal reporter interface
 */
export interface TerminalReporter {
  update: (event: ReporterEvent) => void;
}

/**
 * Message socket endpoint
 */
export interface MessageSocketEndpoint {
  server: unknown;
  broadcast: (method: string, params: unknown) => void;
}

/**
 * Events socket endpoint
 */
export interface EventsSocketEndpoint {
  server: unknown;
  reportEvent: (event: unknown) => void;
}

/**
 * Dev server middleware result
 */
export interface DevServerMiddlewareResult {
  middleware: unknown;
  websocketEndpoints: Record<string, unknown>;
  messageSocketEndpoint: MessageSocketEndpoint;
  eventsSocketEndpoint: EventsSocketEndpoint;
}

/**
 * Dev middleware params
 */
export interface DevServerMiddlewareParams {
  host: string;
  port: number;
  watchFolders: readonly string[];
}
