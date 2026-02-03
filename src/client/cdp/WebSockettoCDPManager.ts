import WebSocketInterceptor from '../interceptor/WebSocketInterceptor';
import DebuggerConnection from '../DebuggerConnection';
import { JS_APP_URL } from '../../shared/constants';

const getWebSocketCdpId = (socketId: number): string => {
  return `ws-${socketId}`;
};

// 1. Connection start: requestWillBeSent
WebSocketInterceptor.setConnectCallback((url, protocols, options, socketId) => {
  if (DebuggerConnection.getSocketId() === socketId || url.includes(JS_APP_URL)) {
    return;
  }

  const requestId = getWebSocketCdpId(socketId);
  const timestamp = Date.now() / 1000;

  DebuggerConnection.send({
    method: 'Network.requestWillBeSent',
    params: {
      requestId,
      request: {
        url,
        headers: {
          'Sec-WebSocket-Protocol': protocols?.join(', ') || '',
          ...options?.headers,
        },
      },
      timestamp,
      wallTime: timestamp,
      initiator: { type: 'script' },
      type: 'WebSocket',
    },
  });
});

// 2. Connection success: webSocketHandshakeResponseReceived
WebSocketInterceptor.setOnOpenCallback((socketId) => {
  if (DebuggerConnection.getSocketId() === socketId) {
    return;
  }

  const requestId = getWebSocketCdpId(socketId);
  const timestamp = Date.now() / 1000;

  // Send responseReceived to update DevTools UI status to 101
  DebuggerConnection.send({
    method: 'Network.responseReceived',
    params: {
      requestId,
      timestamp,
      type: 'WebSocket',
      response: {
        status: 101,
        statusText: 'Switching Protocols',
        headers: {}, // Actual response headers are difficult to obtain
      },
    },
  });

  DebuggerConnection.send({
    method: 'Network.webSocketHandshakeResponseReceived',
    params: {
      requestId,
      timestamp,
      response: {
        status: 101,
        statusText: 'Switching Protocols',
        headers: {},
      },
    },
  });
});

// 3. Message sent (client -> server): webSocketFrameSent
WebSocketInterceptor.setSendCallback((data, socketId) => {
  if (DebuggerConnection.getSocketId() === socketId) {
    return;
  }
  const requestId = getWebSocketCdpId(socketId);
  const timestamp = Date.now() / 1000;

  DebuggerConnection.send({
    method: 'Network.webSocketFrameSent',
    params: {
      requestId,
      timestamp,
      response: {
        opcode: 1, // 1 for text frame
        mask: true,
        payloadData: String(data),
      },
    },
  });
});

// 4. Message received (server -> client): webSocketFrameReceived
WebSocketInterceptor.setOnMessageCallback((socketId, data) => {
  if (DebuggerConnection.getSocketId() === socketId) {
    return;
  }

  const requestId = getWebSocketCdpId(socketId);
  const timestamp = Date.now() / 1000;

  DebuggerConnection.send({
    method: 'Network.webSocketFrameReceived',
    params: {
      requestId,
      timestamp,
      response: {
        opcode: 1, // 1 for text frame
        mask: false,
        payloadData: String(data),
      },
    },
  });
});

// 5. Connection closed: webSocketClosed
WebSocketInterceptor.setOnCloseCallback((socketId, closeData) => {
  if (DebuggerConnection.getSocketId() === socketId) {
    return;
  }

  const requestId = getWebSocketCdpId(socketId);
  const timestamp = Date.now() / 1000;

  DebuggerConnection.send({
    method: 'Network.webSocketClosed',
    params: {
      requestId,
      timestamp,
      code: closeData.code,
      reason: closeData.reason,
    },
  });
});

// 6. Error occurred: webSocketFrameError
WebSocketInterceptor.setOnErrorCallback((socketId, error) => {
  if (DebuggerConnection.getSocketId() === socketId) {
    return;
  }

  const requestId = getWebSocketCdpId(socketId);
  const timestamp = Date.now() / 1000;

  DebuggerConnection.send({
    method: 'Network.webSocketFrameError',
    params: {
      requestId,
      timestamp,
      errorMessage: error.message,
    },
  });
});

// Enable interceptor
WebSocketInterceptor.enableInterception();
