import { DEVICE_KEY } from '../shared/constants';

interface Payload {
  method: string;
  params: Record<string, unknown>;
}

/**
 * Sends payload to dev tools via console.log
 * @param payload - Data object to send to dev tools
 */
const sendToDevMiddleware = (payload: Payload): void => {
  if (!payload || typeof payload !== 'object') {
    console.warn('payload is not an object');
    return;
  }

  const payloadString = JSON.stringify(payload);

  if (!payloadString) {
    console.warn('payload is not a valid JSON string', payload);
    return;
  }

  console.log(DEVICE_KEY, payloadString);
};

export default {
  setId: (id: string): void => {
    sendToDevMiddleware({
      method: 'JSApp.setAppId',
      params: {
        id,
      },
    });
  },
};
