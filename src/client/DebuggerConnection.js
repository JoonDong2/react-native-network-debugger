let ws = null;
let connectionIntervalId = null;

import { JS_APP_URL } from '../shared/constants';
import jsonParseSafely from '../shared/jsonParseSafely';
import { NativeModules } from 'react-native'
import DevMiddlewareConnection from './DevMiddlewareConnection';

const INTERVAL_MS = 1500

const listeners = new Set();
let sendQueue = [];

const id = Math.random().toString(36).substring(2, 15);
const scriptURL = NativeModules?.SourceCode?.scriptURL ?? '';

const regex = /:\/\/([^/:]+):(\d+)/;

const match = scriptURL.match(regex);
const [, host, port] = match;

const clearWS = () => {
    if (ws) {
        ws.close();
        ws = null;
    }
}

const clearInterval = () => {
    if (connectionIntervalId) {
        clearInterval(connectionIntervalId);
        connectionIntervalId = null;
    }
}

const send = (message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        const stringifiedMessage = typeof message === 'string' ? message : JSON.stringify(message);
        ws.send(stringifiedMessage);
    } else {
        sendQueue.push(message);
    }
}

const connect = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }

    DevMiddlewareConnection.setId(id);

    ws = new WebSocket(`ws://${host}:${port}${JS_APP_URL}?id=${id}`);

    ws.onmessage = (event) => {
        if (event.data === 'ping') {
            ws.send('pong');
            return;
        }

        const parsedData = jsonParseSafely(event.data);

        if (parsedData) {
            listeners.forEach(listener => listener(parsedData));
        }
    }

    ws.onopen = () => {
        clearInterval();

        const oldQueue = sendQueue;
        sendQueue = [];
        oldQueue.forEach(send);
    }

    ws.onclose = tryReconnectRepeatly
}



const tryReconnectRepeatly = () => {
    clearInterval();

    clearWS();

    connect();
    
    connectionIntervalId = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            connect();
        }
    }, INTERVAL_MS);
}

export default {
    connect: () => {
        tryReconnectRepeatly();
    },
    send,
    addEventListener: (listener) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        }
    }
}