/**
 * Connection types for debugger and device communication
 */

import type { CDPMessage } from './cdp';

/**
 * JSON-serializable value type
 */
export type JSONSerializable =
  | boolean
  | number
  | string
  | null
  | readonly JSONSerializable[]
  | { readonly [key: string]: JSONSerializable };

/**
 * Interface for sending messages
 */
export interface MessageSender {
  sendMessage: (message: CDPMessage | string) => void;
}

/**
 * Information about an exposed device
 */
export interface ExposedDevice {
  appId: string;
  id: string;
  name: string;
  sendMessage: (message: JSONSerializable) => void;
}

/**
 * Information about an exposed debugger
 */
export interface ExposedDebugger extends MessageSender {
  userAgent: string | null;
}

/**
 * Page information
 */
export interface Page {
  id: string;
  title: string;
  vm: string;
  app: string;
}

/**
 * Connection information between page, device, and debugger
 */
export interface CustomMessageHandlerConnection {
  page: Page;
  device: ExposedDevice;
  debugger: ExposedDebugger;
}

/**
 * Handler for intercepting CDP messages
 */
export interface CustomMessageHandler {
  handleDeviceMessage: (message: JSONSerializable) => boolean | void;
  handleDebuggerMessage: (message: JSONSerializable) => boolean | void;
}

/**
 * Factory function for creating custom message handlers
 */
export type CreateCustomMessageHandlerFn = (
  connection: CustomMessageHandlerConnection
) => CustomMessageHandler | null | undefined;

/**
 * App connection interface
 */
export interface AppConnection {
  sendMessage: (message: CDPMessage | string) => void;
}

/**
 * Listener callback type
 */
export type ConnectionListener = () => void;

/**
 * Message listener callback type
 */
export type MessageListener = (payload: CDPMessage) => void;
