import JSAppProxy from "../../JSAppProxy";
import Domain from "./Domain";

class JSApp extends Domain {
    static name = 'JSApp';

    handler = (connection, payload) => {
        if (payload.method === 'JSApp.setAppId') {
            const appId = payload.params.id;
            JSAppProxy.setDebuggerConnection(appId, connection.debugger);
            
            return Domain.BLOCK;
        }

        return Domain.CONTINUE;
    }
}

export default JSApp;