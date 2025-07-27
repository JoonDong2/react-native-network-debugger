import { JS_APP_URL } from "../shared/constants";
import url from 'url';
import WS from 'ws';

let appCounter = 0;

const idToAppConnection = new Map(); // key: appId, value: app connection

const idToDebuggerConnection = new Map();
const dubbgerConnectionToId = new Map();

const listenersMap = new Map(); // key: app id or debugger connection, value: Set<listener>

const DEBUGGER_HEARTBEAT_INTERVAL_MS = 10000;
const MAX_PONG_LATENCY_MS = 5000;

const createJSAppMiddleware = () => {
    const wss = new WS.Server({
        noServer: true,
        perMessageDeflate: true,
        maxPayload: 0,
    });

    const _startHeartbeat = (socket, intervalMs) => {
        let terminateTimeout = null;

        const pingTimeout = setTimeout(() => {
            if (socket.readyState !== WS.OPEN) {
                pingTimeout.refresh();
                return;
            }

            socket.send('ping')
            terminateTimeout = setTimeout(() => {
                if (socket.readyState !== WS.OPEN) {
                    return;
                }

                socket.terminate();
            }, MAX_PONG_LATENCY_MS);
        }, intervalMs);

        const onPong = (message) => {
            if (message !== 'pong') {
                return;
            }

            terminateTimeout && clearTimeout(terminateTimeout);
            pingTimeout.refresh();
        }

        socket.on('message', onPong);

        socket.on('close', () => {
            terminateTimeout && clearTimeout(terminateTimeout);
            clearTimeout(pingTimeout);
        })
    }

    wss.on('connection', async (socket, req) => {
        const fallbackDeviceId = String(appCounter++);
        const query = url.parse(req.url || '', true).query || {};
        const appId = query.id || fallbackDeviceId;

        idToAppConnection.set(appId, {
            sendMessage: (message) => {
                const stringifiedMessage = typeof message === 'string' ? message : JSON.stringify(message);
                socket.send(stringifiedMessage);
            }
        });

        // notify app connection registration
        const dubugerConnection = idToDebuggerConnection.get(appId);
        if (dubugerConnection) {
            const listeners = listenersMap.get(dubugerConnection);
            listeners?.forEach(listener => listener());
        }

        socket.on('message', (message) => {
            if (message === 'pong') {
                return;
            }

            const debuggerConnection = idToDebuggerConnection.get(appId);
            debuggerConnection?.sendMessage(typeof message === 'string' ? JSON.parse(message) : message);
        });

        _startHeartbeat(socket, DEBUGGER_HEARTBEAT_INTERVAL_MS);

        socket.on('close', () => {
            idToAppConnection.delete(appId);
            idToDebuggerConnection.delete(appId);
            const dubugerConnection = idToDebuggerConnection.get(appId);
            if (dubugerConnection) {
                dubbgerConnectionToId.delete(dubugerConnection);
            }
            listenersMap.delete(appId);
        });
    });

    return {
        [JS_APP_URL]: wss
    }
}

const getAppConnection = (debuggerConnection) => {
    const appId = dubbgerConnectionToId.get(debuggerConnection);
    return idToAppConnection.get(appId);
}

const addAppConnectionListener = (appIdOrDebuggerConnection, listener) => {
    let listeners = listenersMap.get(appIdOrDebuggerConnection);
    if (!listeners) {
        listeners = new Set();
        listenersMap.set(appIdOrDebuggerConnection, listeners);
    }
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            listenersMap.delete(appIdOrDebuggerConnection);
        }
    }
}

const setDebuggerConnection = (appId, debuggerConnection) => {
    idToDebuggerConnection.set(appId, debuggerConnection);
    dubbgerConnectionToId.set(debuggerConnection, appId);
};

export default {
    createJSAppMiddleware,
    getAppConnection,
    addAppConnectionListener,
    setDebuggerConnection,
}