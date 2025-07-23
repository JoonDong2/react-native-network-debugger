import { DEVICE_KEY } from '../shared/constants';

/**
 * 개발자 도구로 payload를 전송합니다.
 * @param {object} payload - 개발자 도구로 보낼 데이터 객체
 * @returns {void}
 */
const sendToDevTools = (payload) => {
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
    setId: (id) => {
        sendToDevTools({
            command: 'set-js-id',
            params: {
                id
            }
        })
    }
};