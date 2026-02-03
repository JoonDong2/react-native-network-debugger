import jsonParseSafely from '../../shared/jsonParseSafely';
import { DEVICE_KEY } from '../../shared/constants';
import Network from './domains/Network';
import JSApp from './domains/JSApp';
import makeDomains from './makeDomains';
import type { CDPMessage } from '../../types/cdp';
import type {
  CustomMessageHandlerConnection,
  CustomMessageHandler,
  JSONSerializable,
  ExposedDebugger,
} from '../../types/connection';

const jsAppIdToConnection = new Map<string, ExposedDebugger>();

interface RuntimeConsolePayload {
  params?: {
    args?: Array<{ value?: unknown }>;
  };
}

const validJSAppMessage = (payload: CDPMessage): boolean => {
  const p = payload as RuntimeConsolePayload;
  return !!(
    p &&
    p.params &&
    Array.isArray(p.params.args) &&
    p.params.args.length === 2 &&
    p.params.args[0].value === DEVICE_KEY
  );
};

const extractOriginPayload = (payload: CDPMessage): CDPMessage | null => {
  const p = payload as RuntimeConsolePayload;
  return jsonParseSafely<CDPMessage>(p.params!.args![1].value as string);
};

/**
 * Creates an inspector message handler for CDP communication
 */
const createInspectorMessageHandler = (
  _connection: CustomMessageHandlerConnection
): CustomMessageHandler => {
  const connection = _connection;

  const domains = makeDomains([new Network(connection), new JSApp()]);

  return {
    handleDeviceMessage: (payload: JSONSerializable): boolean | void => {
      const cdpPayload = payload as CDPMessage;
      const domain1 = domains.get(cdpPayload.method);

      if (domain1) {
        return domain1.handler(connection, cdpPayload);
      }

      if (!validJSAppMessage(cdpPayload)) {
        return false; // continue
      }

      const originPayload = extractOriginPayload(cdpPayload);
      if (!originPayload) {
        return true; // stop
      }

      const domain2 = domains.get(originPayload.method);

      if (domain2) {
        return domain2.handler(connection, originPayload);
      }

      return true; // stop
    },
    handleDebuggerMessage: (payload: JSONSerializable): boolean | void => {
      const cdpPayload = payload as CDPMessage;
      const domain = domains.get(cdpPayload.method);

      if (domain) {
        return domain.handler(connection, cdpPayload);
      }

      return false; // continue
    },
  };
};

const getDebuggerFromJSAppId = (jsAppId: string): ExposedDebugger | undefined => {
  return jsAppIdToConnection.get(jsAppId);
};

export default {
  createInspectorMessageHandler,
  getDebuggerFromJSAppId,
};
