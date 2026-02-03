/**
 * Domain types for Inspector message handling
 */

import type { CDPMessage } from './cdp';
import type { CustomMessageHandlerConnection } from './connection';

/**
 * Handler function signature for domain handlers
 */
export type DomainHandler = (
  connection: CustomMessageHandlerConnection,
  payload: CDPMessage
) => boolean;

/**
 * Domain interface
 */
export interface IDomain {
  handler: DomainHandler;
}

/**
 * Domains map interface
 */
export interface DomainsMap {
  get: (method: string | undefined) => IDomain | undefined;
}
