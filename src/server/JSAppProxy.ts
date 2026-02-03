import { JS_APP_URL } from "../shared/constants";
import url from "url";
import type { WebSocketServer, RawData, WebSocket as WebSocketType } from "ws";
import type { IncomingMessage } from "http";
import type { CDPMessage } from "../types/cdp";
import type {
  AppConnection,
  ExposedDebugger,
  ConnectionListener,
} from "../types/connection";

// Use require for CommonJS compatibility - named exports don't work correctly with Rollup external bundling
const WS = require("ws") as {
  Server: typeof WebSocketServer;
  OPEN: number;
};

let appCounter = 0;

const idToAppConnection = new Map<string, AppConnection>(); // key: appId, value: app connection

const idToDebuggerConnection = new Map<string, ExposedDebugger>();
const debuggerConnectionToId = new Map<ExposedDebugger, string>();

const listenersMap = new Map<
  string | ExposedDebugger,
  Set<ConnectionListener>
>(); // key: app id or debugger connection, value: Set<listener>

const DEBUGGER_HEARTBEAT_INTERVAL_MS = 10000;
const MAX_PONG_LATENCY_MS = 5000;

const createJSAppMiddleware = (): Record<string, WebSocketServer> => {
  const wss = new WS.Server({
    noServer: true,
    perMessageDeflate: true,
    maxPayload: 0,
  });

  const _startHeartbeat = (socket: WebSocketType, intervalMs: number): void => {
    let terminateTimeout: ReturnType<typeof setTimeout> | null = null;

    const pingTimeout = setTimeout(() => {
      if (socket.readyState !== WS.OPEN) {
        pingTimeout.refresh();
        return;
      }

      socket.send("ping");
      terminateTimeout = setTimeout(() => {
        if (socket.readyState !== WS.OPEN) {
          return;
        }

        socket.terminate();
      }, MAX_PONG_LATENCY_MS);
    }, intervalMs);

    const onPong = (message: RawData): void => {
      if (message.toString() !== "pong") {
        return;
      }

      terminateTimeout && clearTimeout(terminateTimeout);
      pingTimeout.refresh();
    };

    socket.on("message", onPong);

    socket.on("close", () => {
      terminateTimeout && clearTimeout(terminateTimeout);
      clearTimeout(pingTimeout);
    });
  };

  wss.on("connection", async (socket: WebSocketType, req: IncomingMessage) => {
    const fallbackDeviceId = String(appCounter++);
    const query = url.parse(req.url || "", true).query || {};
    const appId = (query.id as string) || fallbackDeviceId;

    idToAppConnection.set(appId, {
      sendMessage: (message: CDPMessage | string): void => {
        const stringifiedMessage =
          typeof message === "string" ? message : JSON.stringify(message);
        socket.send(stringifiedMessage);
      },
    });

    // notify app connection registration
    const debuggerConnection = idToDebuggerConnection.get(appId);
    if (debuggerConnection) {
      const listeners = listenersMap.get(debuggerConnection);
      listeners?.forEach((listener) => listener());
    }

    socket.on("message", (message: RawData) => {
      if (message.toString() === "pong") {
        return;
      }

      const debuggerConn = idToDebuggerConnection.get(appId);
      debuggerConn?.sendMessage(
        typeof message === "string"
          ? JSON.parse(message)
          : JSON.parse(message.toString())
      );
    });

    _startHeartbeat(socket, DEBUGGER_HEARTBEAT_INTERVAL_MS);

    socket.on("close", () => {
      idToAppConnection.delete(appId);
      idToDebuggerConnection.delete(appId);
      const dbgConnection = idToDebuggerConnection.get(appId);
      if (dbgConnection) {
        debuggerConnectionToId.delete(dbgConnection);
      }
      listenersMap.delete(appId);
    });
  });

  return {
    [JS_APP_URL]: wss,
  };
};

const getAppConnection = (
  debuggerConnection: ExposedDebugger
): AppConnection | undefined => {
  const appId = debuggerConnectionToId.get(debuggerConnection);
  if (!appId) return undefined;
  return idToAppConnection.get(appId);
};

const addAppConnectionListener = (
  appIdOrDebuggerConnection: string | ExposedDebugger,
  listener: ConnectionListener
): (() => void) => {
  let listeners = listenersMap.get(appIdOrDebuggerConnection);
  if (!listeners) {
    listeners = new Set();
    listenersMap.set(appIdOrDebuggerConnection, listeners);
  }
  listeners.add(listener);

  return () => {
    listeners!.delete(listener);
    if (listeners!.size === 0) {
      listenersMap.delete(appIdOrDebuggerConnection);
    }
  };
};

const setDebuggerConnection = (
  appId: string,
  debuggerConnection: ExposedDebugger
): void => {
  idToDebuggerConnection.set(appId, debuggerConnection);
  debuggerConnectionToId.set(debuggerConnection, appId);
};

export default {
  createJSAppMiddleware,
  getAppConnection,
  addAppConnectionListener,
  setDebuggerConnection,
};
