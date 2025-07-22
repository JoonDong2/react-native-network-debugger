import jsonParseSafely from "../../shared/jsonParseSafely";
import { DEVICE_KEY } from "../../shared/constants";
import JSAppProxy from '../jsAppProxy';

const jsAppIdToDebugger = new Map();

/**
 * Defines a type for JSON-serializable values.
 * (boolean, number, string, null, or an array or object containing these types).
 * All properties are read-only.
 * @typedef {boolean | number | string | null | ReadonlyArray<JSONSerializable> | {readonly [key: string]: JSONSerializable}} JSONSerializable
 */


/**
 * An interface for a handler that intercepts and processes CDP messages between the device and the debugger.
 * @typedef {object} CustomMessageHandler
 * @property {(message: JSONSerializable) => true | void} handleDeviceMessage - Handles a CDP message coming from the device. This function is invoked before the message is sent to the debugger. Returning `true` considers the message handled, and it will not be sent to the debugger.
 * @property {(message: JSONSerializable) => true | void} handleDebuggerMessage - Handles a CDP message coming from the debugger. This function is invoked before the message is sent to the device. Returning `true` considers the message handled, and it will not be sent to the device.
 */

/**
 * Read-only information about an exposed device.
 * @typedef {object} ExposedDevice
 * @property {string} appId - The application ID.
 * @property {string} id - The unique ID of the device.
 * @property {string} name - The name of the device.
 * @property {(message: JSONSerializable) => void} sendMessage - A function to send a message to the device.
 */

/**
 * Read-only information about an exposed debugger.
 * @typedef {object} ExposedDebugger
 * @property {string | null} userAgent - The User-Agent string of the debugger.
 * @property {(message: JSONSerializable) => void} sendMessage - A function to send a message to the debugger.
 */

/**
 * Represents the connection information between a page, a device, and a debugger.
 * @typedef {object} CustomMessageHandlerConnection
 * @property {Page} page - Information about the connected page.
 * @property {ExposedDevice} device - Information about the connected device.
 * @property {ExposedDebugger} debugger - Information about the connected debugger.
 */

/**
 * Defines the type for a factory function that creates a custom message handler.
 * This function is invoked whenever a new connection is established.
 * @callback CreateCustomMessageHandlerFn
 * @param {CustomMessageHandlerConnection} connection - The connection object, containing page, device, and debugger information.
 * @returns {CustomMessageHandler | null | undefined} The created custom message handler, or null/undefined if no handler should be applied.
 */
const createInspectorMessageHandler = (_connection) => {
  const connection = _connection;
  let jsAppId = null;
  
  return {
    handleDeviceMessage: (payload) => {
        if (jsAppId && payload && payload.method === 'Runtime.executionContextDestroyed') {
          jsAppIdToDebugger.delete(jsAppId);
          jsAppId = null;
        }

        if (!payload 
            || !payload.params 
            || !Array.isArray(payload.params.args) 
            || payload.params.args.length !== 2
            || payload.params.args[0].value !== DEVICE_KEY) {
            return false; // continue
        }

        const originPayload = jsonParseSafely(payload.params.args[1].value);
        if (!originPayload) {
            console.warn('payload is not a valid JSON string', payload.params.args[1].value)
            return true; // anyway.. it's not a message for devtools.
        }

        if (originPayload.command === 'set-js-id' && originPayload.params?.id) {
            jsAppId = originPayload.params.id;
            jsAppIdToConnection.set(jsAppId, connection.debugger);
        }

        return true; // stop
    },
    handleDebuggerMessage: (payload) => {
      if (jsAppId) {
        const socket = JSAppProxy.getSocketFromJSAppId(jsAppId);
        if (socket) {
          socket.send(JSON.stringify(payload));
        }
      }

      return false;// continue

    }
  }
};

const getDebuggerFromJSAppId = (jsAppId) => {
  return jsAppIdToDebugger.get(jsAppId);
}

export default {
  createInspectorMessageHandler,
  getDebuggerFromJSAppId,
}