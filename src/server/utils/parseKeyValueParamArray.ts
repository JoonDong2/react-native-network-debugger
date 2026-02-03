/**
 * @file This script provides a utility function to parse an array of key-value strings.
 * @copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Parses an array of "key=value" strings into a single object.
 * Throws an error if the strings are not in the expected format.
 */
export default function parseKeyValueParamArray(
  keyValueArray: readonly string[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const item of keyValueArray) {
    if (item.indexOf('=') === -1) {
      throw new Error('Expected parameter to include "=" but found: ' + item);
    }
    if (item.indexOf('&') !== -1) {
      throw new Error('Parameter cannot include "&" but found: ' + item);
    }
    const params = new URLSearchParams(item);
    params.forEach((value, key) => {
      result[key] = value;
    });
  }

  return result;
}
