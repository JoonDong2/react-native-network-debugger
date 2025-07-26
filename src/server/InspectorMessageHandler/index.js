import jsonParseSafely from "../../shared/jsonParseSafely";
import { DEVICE_KEY } from "../../shared/constants";
import Network from "./domains/Network";
import JSApp from "./domains/JSApp";
import makeDomains from "./makeDomains";

const jsAppIdToConnection = new Map();

const validJSAppMessage = (payload) => {
    return payload 
    && payload.params 
    && Array.isArray(payload.params.args) 
    && payload.params.args.length === 2
    && payload.params.args[0].value === DEVICE_KEY;
}

const extractOriginPayload = (payload) => {
    return jsonParseSafely(payload.params.args[1].value);
}

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

  const domains = makeDomains([new Network(connection), new JSApp()]);
  
  return {
    handleDeviceMessage: (payload) => {
        const domain1 = domains.get(payload.method);

        if (domain1) {
            return domain1.handler(connection, payload);
        }

        if (!validJSAppMessage(payload)) {
            return false; // continue
        }

        const originPayload = extractOriginPayload(payload);
        const domain2 = domains.get(originPayload.method);

        if (domain2) {
            return domain2.handler(connection, originPayload);
        }

        return true; // stop
    },
    handleDebuggerMessage: (payload) => {
      const domain = domains.get(payload.method);

      if (domain) {
        return domain.handler(connection, payload);
      }

      return false; // continue
    }
  }
};

const getDebuggerFromJSAppId = (jsAppId) => {
  return jsAppIdToConnection.get(jsAppId);
}

export default {
  createInspectorMessageHandler,
  getDebuggerFromJSAppId,
}