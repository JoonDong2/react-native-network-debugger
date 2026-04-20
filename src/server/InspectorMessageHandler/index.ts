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

const createInspectorMessageHandler = (
  _connection: CustomMessageHandlerConnection
): CustomMessageHandler => {
  const connection = _connection;

  // 네이티브 NetworkHandler(RN 0.83+)가 송신하는 Network.* 이벤트를 모두 차단한다.
  // 라이브러리 client(XHRtoCDPManager, WebSockettoCDPManager)가 JSAppProxy 경유로
  // HTTP/WS CDP 이벤트를 직접 발행하므로 네이티브 이벤트를 통과시키면 중복 기록이
  // 발생한다. 또한 커스텀 debugger-frontend에 주입한 WS 필터는 라이브러리가 보내는
  // 형식을 기준으로 하므로 네이티브 소스가 섞이면 필터링이 깨진다.
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
