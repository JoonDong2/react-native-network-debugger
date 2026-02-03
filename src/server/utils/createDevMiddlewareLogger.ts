/**
 * @file Creates a logger for dev middleware that integrates with Metro's terminal reporter.
 * @copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalReporter } from '../../types/metro';

type LoggerFn = (...message: unknown[]) => void;

interface Logger {
  info: LoggerFn;
  warn: LoggerFn;
  error: LoggerFn;
}

/**
 * Create a dev-middleware logger object that will emit logs via Metro's
 * terminal reporter.
 */
export default function createDevMiddlewareLogger(
  reporter: TerminalReporter
): Readonly<Logger> {
  return {
    info: makeLogger(reporter, 'info'),
    warn: makeLogger(reporter, 'warn'),
    error: makeLogger(reporter, 'error'),
  };
}

/**
 * Creates a logging function for a specific level.
 */
function makeLogger(
  reporter: TerminalReporter,
  level: 'info' | 'warn' | 'error'
): LoggerFn {
  return (...data: unknown[]): void =>
    reporter.update({
      type: 'unstable_server_log',
      level,
      data,
    });
}
