/**
 * @file Defines custom error classes and string utilities for the CLI.
 * @copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * A custom Error that creates a single-lined message to match current styling inside CLI.
 * Uses original stack trace when `originalError` is passed or erases the stack if it's not defined.
 */
export class CLIError extends Error {
  /**
   * @param {string} msg The error message.
   * @param {Error | string} [originalError] The original error or a string representation of its stack.
   */
  constructor(msg, originalError) {
    super(inlineString(msg));
    if (originalError != null) {
      this.stack =
        typeof originalError === 'string'
          ? originalError
          : originalError.stack || ''.split('\n').slice(0, 2).join('\n');
    } else {
      // When the "originalError" is not passed, it means that we know exactly
      // what went wrong and provide means to fix it. In such cases showing the
      // stack is an unnecessary clutter to the CLI output, hence removing it.
      this.stack = '';
    }
  }
}

/**
 * Raised when we're unable to find a package.json
 */
export class UnknownProjectError extends Error {}

/**
 * Replaces multiple whitespace characters with a single space and trims the result.
 * @param {string} [str=''] The input string to format.
 * @returns {string} The formatted string.
 */
export const inlineString = (str = '') =>
  str.replace(/(\s{2,})/gm, ' ').trim();
