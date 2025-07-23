/**
 * @file Creates a logger for dev middleware that integrates with Metro's terminal reporter.
 * @copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @callback LoggerFn
 * @param {...any} message The message parts to log.
 */

/**
 * Create a dev-middleware logger object that will emit logs via Metro's
 * terminal reporter.
 * @param {object} reporter The Metro terminal reporter instance.
 * @returns {Readonly<{info: LoggerFn, error: LoggerFn, warn: LoggerFn}>} A logger object with info, warn, and error methods.
 */
export default function createDevMiddlewareLogger(reporter) {
  return {
    info: makeLogger(reporter, 'info'),
    warn: makeLogger(reporter, 'warn'),
    error: makeLogger(reporter, 'error'),
  };
}

/**
 * Creates a logging function for a specific level.
 * @param {object} reporter The Metro terminal reporter instance.
 * @param {'info' | 'warn' | 'error'} level The log level.
 * @returns {LoggerFn} A function that logs messages at the specified level.
 */
function makeLogger(reporter, level) {
  return (...data) =>
    reporter.update({
      type: 'unstable_server_log',
      level,
      data,
    });
}
