import jsAppProxy from "../../jsAppProxy";
import Domain from "./Domain";

class Network extends Domain {
    queue = [];

    static name = 'Network';

    enabled = false;

    constructor(connection) {
        super();
        jsAppProxy.addAppConnectionListener(connection.debugger, () => {
            const appConnection = jsAppProxy.getAppConnection(connection.debugger);
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
        }
    }

    handler = (connection, payload) => {
        const specificHandler = typeof payload.method === 'string' && this.#specificHandlers[payload.method];

        if (specificHandler) {
            return specificHandler(connection, payload);
        }

        if (this.enabled) {
            this.queue.push(payload);
            return Domain.BLOCK;
        } 
        
        // TODO: Send Network.getResponseBody method etc. to JS app

        return Domain.BLOCK;
    }
}

export default Network;