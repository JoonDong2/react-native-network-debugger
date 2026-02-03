import { JS_APP_URL } from '../shared/constants';
import jsonParseSafely from '../shared/jsonParseSafely';
import DevMiddlewareConnection from './DevMiddlewareConnection';
import { getHost } from './utils/host';
import type { CDPMessage } from '../types/cdp';
import type { MessageListener } from '../types/connection';

interface ExtendedWebSocket extends WebSocket {
  _socketId?: number;
}

let ws: ExtendedWebSocket | null = null;
let connectionIntervalId: ReturnType<typeof setInterval> | null = null;
let isConnecting = false;

const INTERVAL_MS = 1500;

let socketId: number | null = null;

const listeners = new Set<MessageListener>();
let sendQueue: (CDPMessage | string)[] = [];

const id = Math.random().toString(36).substring(2, 15);
const { host, port } = getHost();

const clearWS = (): void => {
  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.close();
    ws = null;
  }
};

const stopReconnectTimer = (): void => {
  if (connectionIntervalId) {
    clearInterval(connectionIntervalId);
    connectionIntervalId = null;
  }
};

const send = (message: CDPMessage | string): void => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const stringifiedMessage =
      typeof message === 'string' ? message : JSON.stringify(message);
    ws.send(stringifiedMessage);
  } else {
    sendQueue.push(message);
  }
};

const connect = (): void => {
  if ((ws && ws.readyState === WebSocket.OPEN) || isConnecting) {
    return;
  }

  isConnecting = true;
  DevMiddlewareConnection.setId(id);

  ws = new WebSocket(
    `ws://${host}:${port}${JS_APP_URL}?id=${id}`
  ) as ExtendedWebSocket;

  ws.onmessage = (event: MessageEvent): void => {
    if (event.data === 'ping') {
      ws!.send('pong');
      return;
    }

    const parsedData = jsonParseSafely<CDPMessage>(event.data);
    if (parsedData) {
      listeners.forEach((listener) => listener(parsedData));
    }
  };

  ws.onopen = (): void => {
    socketId = ws!._socketId ?? null;
    isConnecting = false;
    stopReconnectTimer();

    const oldQueue = sendQueue;
    sendQueue = [];
    oldQueue.forEach(send);
  };

  ws.onclose = (): void => {
    isConnecting = false;
    clearWS();
    startReconnectProcess();
  };

  ws.onerror = (): void => {
    isConnecting = false;
  };
};

const startReconnectProcess = (): void => {
  stopReconnectTimer();
  connect();
  connectionIntervalId = setInterval(() => {
    connect();
  }, INTERVAL_MS);
};

export default {
  connect: (): void => {
    startReconnectProcess();
  },
  send,
  addEventListener: (listener: MessageListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSocketId: (): number | null => {
    return socketId;
  },
};
