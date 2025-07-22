import { JS_APP_URL } from "../shared/constants";
import InspectorMessageHandler from "./inspector-message-handler";
import url from 'url';
import WS from 'ws';

let appCounter = 0;

const idToSocket = new Map();

const DEBUGGER_HEARTBEAT_INTERVAL_MS = 10000;
const MAX_PONG_LATENCY_MS = 5000;

const createJSAppMiddleware = () => {
    const wss = new WS.Server({
        noServer: true,
        perMessageDeflate: true,
        maxPayload: 0,
    });

    const _startHeartbeat = (socket, intervalMs) => {
        let shouldSetTerminateTimeout = false;
        let terminateTimeout = null;

        const pingTimeout = setTimeout(() => {
            if (socket.readyState !== WS.OPEN) {
                pingTimeout.refresh();
                return;
            }

            shouldSetTerminateTimeout = true;

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

            shouldSetTerminateTimeout = false;
            terminateTimeout && clearTimeout(terminateTimeout);
            pingTimeout.refresh();
        }

        socket.on('message', onPong);

        socket.on('close', () => {
            shouldSetTerminateTimeout = false;
            terminateTimeout && clearTimeout(terminateTimeout);
            clearTimeout(pingTimeout);
        })
    }

    wss.on('connection', async (socket, req) => {
        const fallbackDeviceId = String(appCounter++);
        const query = url.parse(req.url || '', true).query || {};
        const appId = query.id || fallbackDeviceId;

        const oldSocket = idToSocket.get(appId);
        if (oldSocket) {
            oldSocket.close();
        }

        idToSocket.set(appId, socket);

        socket.on('message', (message) => {
            if (message !== 'pong') {
                return;
            }
            
            const _debugger = InspectorMessageHandler.getDebuggerFromJSAppId(appId);
            if (_debugger) {
                _debugger.sendMessage(message);
            }
        })

        _startHeartbeat(socket, DEBUGGER_HEARTBEAT_INTERVAL_MS);

        socket.on('close', () => {
            idToSocket.delete(appId);
        });
    });

    return {
        [JS_APP_URL]: wss
    }
}

const getSocketFromJSAppId = (appId) => {
    return idToSocket.get(appId);
}

export default {
    createJSAppMiddleware,
    getSocketFromJSAppId,
}