import XHRInterceptor from './interceptor/interceptor/XHRInterceptor';

// 요청 정보를 임시 저장하는 맵
// Key: requestId, Value: { request, responseBody, encodedDataLength }
const requests = new Map();

// XMLHttpRequest 인스턴스와 requestId를 매핑하는 WeakMap
// XHR 객체가 가비지 컬렉션될 때 메모리 누수를 방지합니다.
// Key: XMLHttpRequest instance, Value: requestId
const xhrToRequestId = new WeakMap();

const interceptXHR = () => {
    // 1. open: 요청 시작, requestId 생성
    XHRInterceptor.setOpenCallback((method, url, xhr) => {
        const requestId = `xhr-interceptor-${Math.random().toString(36).substring(2, 9)}`;
        xhrToRequestId.set(xhr, requestId);

        requests.set(requestId, {
            request: {
                url,
                method: method.toUpperCase(),
                headers: {},
            },
            responseBody: null,
            encodedDataLength: 0,
        });
    });
    
    // 2. setRequestHeader: 요청 헤더 수집
    XHRInterceptor.setRequestHeaderCallback((header, value, xhr) => {
        const requestId = xhrToRequestId.get(xhr);
        if (!requestId) return;

        const data = requests.get(requestId);
        if (data) {
            data.request.headers[header] = value;
        }
    });

    // 3. send: `Network.requestWillBeSent` 이벤트 발생
    XHRInterceptor.setSendCallback((data, xhr) => {
        const requestId = xhrToRequestId.get(xhr);
        if (!requestId) return;

        const requestData = requests.get(requestId);
        if (requestData) {
        if (data) {
            requestData.request.postData = String(data);
        }
        
        const timestamp = Date.now() / 1000;

        sendCDPEvent('Network.requestWillBeSent', {
            requestId,
            loaderId: 'XHRInterceptorLoader',
            documentURL: 'app://localhost', // 앱의 컨텍스트에 맞게 수정
            request: requestData.request,
            timestamp,
            wallTime: timestamp,
            initiator: { type: 'script' },
            type: 'XHR',
        });
        }
    });

    // 4. HEADERS_RECEIVED: `Network.responseReceived` 이벤트 발생
    XHRInterceptor.setHeaderReceivedCallback((contentType, size, headersString, xhr) => {
        const requestId = xhrToRequestId.get(xhr);
        if (!requestId) return;

        const requestData = requests.get(requestId);
        if (requestData) {
            requestData.encodedDataLength = size || 0;
        }

        const headers = {};
        headersString.trim().split(/[\r\n]+/).forEach(line => {
            const parts = line.split(': ');
            const header = parts.shift();
            const value = parts.join(': ');
            if (header) {
                headers[header] = value;
            }
        });

        const timestamp = Date.now() / 1000;
        
        sendCDPEvent('Network.responseReceived', {
            requestId,
            loaderId: 'XHRInterceptorLoader',
            timestamp,
            type: 'XHR',
            response: {
                url: xhr.responseURL || requests.get(requestId)?.request.url,
                status: xhr.status,
                statusText: xhr.statusText,
                headers,
                mimeType: contentType || 'application/octet-stream',
                connectionReused: false,
                connectionId: 0,
                fromDiskCache: false,
                fromServiceWorker: false,
                encodedDataLength: size || 0,
                securityState: 'unknown',
            },
        });
    });

    // 5. DONE: `Network.loadingFinished` 또는 `Network.loadingFailed` 이벤트 발생
    XHRInterceptor.setResponseCallback((status, timeout, response, responseURL, responseType, xhr) => {
        const requestId = xhrToRequestId.get(xhr);
        if (!requestId) return;

        const requestData = requests.get(requestId);
        const timestamp = Date.now() / 1000;

        // `response`가 Blob이나 ArrayBuffer일 수 있으므로 텍스트로 변환 시 주의
        if (requestData && response && typeof response === 'string') {
            requestData.responseBody = response;
        }

        if (status > 0) {
            // 성공
            sendCDPEvent('Network.loadingFinished', {
                requestId,
                timestamp,
                encodedDataLength: requestData?.encodedDataLength || response.length || 0,
            });
        } else {
            // 실패 (네트워크 오류 등)
            sendCDPEvent('Network.loadingFailed', {
                requestId,
                timestamp,
                type: 'XHR',
                errorText: 'Network request failed', // 실제 오류 메시지가 있다면 대체
                canceled: false,
            });
        }

        // 작업 완료 후 데이터 정리 (선택 사항)
        requests.delete(requestId);
    });

    XHRInterceptor.enableInterception();
}

export default interceptXHR;