import type { CDPMessage } from '../../../types/cdp';
import type { CustomMessageHandlerConnection } from '../../../types/connection';
import type { IDomain, DomainHandler } from '../../../types/domain';

class Domain implements IDomain {
  static BLOCK = true;
  static CONTINUE = false;

  constructor() {
    if (!this.constructor.name) {
      throw new Error('Domain name is required');
    }
  }

  handler: DomainHandler = (
    _connection: CustomMessageHandlerConnection,
    _payload: CDPMessage
  ): boolean => {
    throw new Error('Handler is not implemented');
  };
}

export default Domain;
