import 'react-native/Libraries/Core/InitializeCore.js';
import sendToDevTools from './sendToDevTools';
import { NativeModules } from 'react-native'
import { JS_APP_URL } from '../shared/constants';

const id = Math.random().toString(36).substring(2, 15);
const scriptURL = NativeModules?.SourceCode?.scriptURL ?? '';

const regex = /:\/\/([^/:]+):(\d+)/;

const match = scriptURL.match(regex);
const [, host, port] = match;

let ws = null;
let connectionIntervalId = null;

const connect = () => {
    sendToDevTools({
        command: 'set-js-id',
        params: {
            id
        }
    })

    ws = new WebSocket(`ws://${host}:${port}${JS_APP_URL}?id=${id}`);

    ws.onmessage = (event) => {
        if (event.data === 'ping') {
            ws.send('pong');
            return;
        }
    }

    ws.onopen = () => {
        if (connectionIntervalId) {
            clearInterval(connectionIntervalId);
        }
    }

    ws.onclose = () => {
        tryReconnectRepeatly();
    }
}

const tryReconnectRepeatly = () => {
    if (connectionIntervalId) {
        clearInterval(connectionIntervalId);
    }

    connectionIntervalId = setInterval(() => {
        console.log('tryReconnectRepeatly', ws?.readyState);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            connect();
        }
    }, 1000);
}

connect();
tryReconnectRepeatly();
