import WebSocketInterceptor from '../interceptor/WebSocketInterceptor';
import DebuggerConnection from '../DebuggerConnection';
import { JS_APP_URL } from '../../shared/constants';

const getWebSocketCdpId = (socketId) => {
    return `ws-${socketId}`;
}


// 1. 연결 시작: requestWillBeSent
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

// 2. 연결 성공: webSocketHandshakeResponseReceived
WebSocketInterceptor.setOnOpenCallback(socketId => {
    if (DebuggerConnection.getSocketId() === socketId) {
        return;
    }

    const requestId = getWebSocketCdpId(socketId);
    const timestamp = Date.now() / 1000;

    // DevTools UI가 상태를 101로 업데이트하도록 responseReceived도 보내줍니다.
    DebuggerConnection.send({
        method: 'Network.responseReceived',
        params: {
            requestId,
            timestamp,
            type: 'WebSocket',
            response: {
                status: 101,
                statusText: 'Switching Protocols',
                headers: {}, // 실제 응답 헤더를 얻기 어려우므로 비워둡니다.
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

// 3. 메시지 전송(클라이언트 -> 서버): webSocketFrameSent
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

// 4. 메시지 수신(서버 -> 클라이언트): webSocketFrameReceived
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

// 5. 연결 종료: webSocketClosed
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

// 6. 에러 발생: webSocketFrameError
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

// 인터셉터 활성화
WebSocketInterceptor.enableInterception();