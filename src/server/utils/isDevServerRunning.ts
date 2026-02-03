/**
 * @file Checks if a development server is running on a given port.
 * @copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import net from 'net';

type DevServerStatus =
  | 'not_running'
  | 'matched_server_running'
  | 'port_taken'
  | 'unknown';

/**
 * Determine whether we can run the dev server.
 *
 * Return values:
 * - `not_running`: The port is unoccupied.
 * - `matched_server_running`: The port is occupied by another instance of this
 * dev server (matching the passed `projectRoot`).
 * - `port_taken`: The port is occupied by another process.
 * - `unknown`: An error was encountered; attempt server creation anyway.
 */
export default async function isDevServerRunning(
  devServerUrl: string,
  projectRoot: string
): Promise<DevServerStatus> {
  const { hostname, port } = new URL(devServerUrl);

  try {
    if (!(await isPortOccupied(hostname, port))) {
      return 'not_running';
    }

    const statusResponse = await fetch(`${devServerUrl}/status`);
    const body = await statusResponse.text();

    return body === 'packager-status:running' &&
      statusResponse.headers.get('X-React-Native-Project-Root') === projectRoot
      ? 'matched_server_running'
      : 'port_taken';
  } catch {
    return 'unknown';
  }
}

/**
 * Checks if a given port is already in use.
 */
async function isPortOccupied(hostname: string, port: string): Promise<boolean> {
  let result = false;
  const server = net.createServer();

  return new Promise((resolve, reject) => {
    server.once('error', (e: NodeJS.ErrnoException) => {
      server.close();
      if (e.code === 'EADDRINUSE') {
        result = true;
      } else {
        reject(e);
      }
    });
    server.once('listening', () => {
      result = false;
      server.close();
    });
    server.once('close', () => {
      resolve(result);
    });
    server.listen({ host: hostname, port: Number(port) });
  });
}
