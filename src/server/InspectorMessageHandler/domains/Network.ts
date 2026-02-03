import JSAppProxy from '../../JSAppProxy';
import Domain from './Domain';
import type { CDPMessage } from '../../../types/cdp';
import type { CustomMessageHandlerConnection, AppConnection } from '../../../types/connection';
import type { DomainHandler } from '../../../types/domain';

type SpecificHandler = (
  connection: CustomMessageHandlerConnection | AppConnection,
  payload: CDPMessage
) => boolean;

class Network extends Domain {
  queue: CDPMessage[] = [];

  static domainName = 'Network';

  enabled = false;

  constructor(connection: CustomMessageHandlerConnection) {
    super();
    JSAppProxy.addAppConnectionListener(connection.debugger, () => {
      const appConnection = JSAppProxy.getAppConnection(connection.debugger);
      this.#flushQueue(appConnection);
    });
  }

  #flushQueue = (appConnection: AppConnection | undefined): void => {
    if (!appConnection) {
      return;
    }

    const oldQueue = this.queue;
    this.queue = [];
    oldQueue.forEach((payload) => appConnection.sendMessage(payload));
  };

  #specificHandlers: Record<string, SpecificHandler> = {
    'Network.enable': (_connection, _payload): boolean => {
      this.enabled = true;
      this.#flushQueue(_connection as AppConnection);
      return Domain.BLOCK;
    },
    'Network.disable': (): boolean => {
      this.enabled = false;
      return Domain.BLOCK;
    },
    'Network.getResponseBody': (connection, payload): boolean => {
      const appConnection = JSAppProxy.getAppConnection(
        (connection as CustomMessageHandlerConnection).debugger
      );
      appConnection?.sendMessage(payload);
      return Domain.BLOCK;
    },
  };

  override handler: DomainHandler = (
    connection: CustomMessageHandlerConnection,
    payload: CDPMessage
  ): boolean => {
    const specificHandler =
      typeof payload.method === 'string' && this.#specificHandlers[payload.method];

    if (specificHandler) {
      return specificHandler(connection, payload);
    }

    return Domain.BLOCK;
  };
}

export default Network;
