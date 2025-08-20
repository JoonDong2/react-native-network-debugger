import JSAppProxy from "../../JSAppProxy";
import Domain from "./Domain";

class Network extends Domain {
    queue = [];

    static name = 'Network';

    enabled = false;

    constructor(connection) {
        super();
        JSAppProxy.addAppConnectionListener(connection.debugger, () => {
            const appConnection = JSAppProxy.getAppConnection(connection.debugger);
            this.#flushQueue(appConnection);
        });
    }

    #flushQueue = (appConnection) => {
        if (!appConnection) {
            return;
        }

        const oldQueue = this.queue;
        this.queue = [];
        oldQueue.forEach(payload => appConnection.sendMessage(payload));
    }

    #specificHandlers = {
        'Network.enable': (connection, payload) => {
            this.enabled = true;
            this.#flushQueue(connection);
            return Domain.BLOCK;
        },
        'Network.disable': () => {
            this.enabled = false;
            return Domain.BLOCK;
        },
        'Network.getResponseBody': (connection, payload) => {
            const appConnection = JSAppProxy.getAppConnection(connection.debugger);
            appConnection?.sendMessage(payload);
            return Domain.BLOCK;
        }
    }

    handler = (connection, payload) => {
        const specificHandler = typeof payload.method === 'string' && this.#specificHandlers[payload.method];

        if (specificHandler) {
            return specificHandler(connection, payload);
        }

        return Domain.BLOCK;
    }
}

export default Network;