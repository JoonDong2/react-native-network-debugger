import DebuggerConnection from '../DebuggerConnection';
import XHRInterceptor from '../interceptor/XHRInterceptor';
import { getId } from '../utils/id';
import { NativeModules } from 'react-native'

// 요청 정보를 임시 저장하는 맵
// Key: requestId, Value: { request, responseBody, encodedDataLength }
const requests = new Map();

// XMLHttpRequest 인스턴스와 requestId를 매핑하는 WeakMap
// XHR 객체가 가비지 컬렉션될 때 메모리 누수를 방지합니다.
// Key: XMLHttpRequest instance, Value: requestId 
const xhrToRequestId = new WeakMap();

// TODO: intercept XHR requests/response and send CDP messages using DubuggerConnection.send
XHRInterceptor.setOpenCallback((method, url, xhr) => {
    if (url.endsWith('/symbolicate')) {
        return;
    }

    const requestId = `xhr-${getId()}`;
    xhrToRequestId.set(xhr, requestId);

    requests.set(requestId, {
        request: {
            url,
            method: method.toUpperCase(),
            headers: {},
        },
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

        DebuggerConnection.send({
            method: 'Network.requestWillBeSent',
            params: {
                requestId,
                documentURL: NativeModules?.SourceCode?.scriptURL ?? '', 
                request: requestData.request,
                timestamp,
                wallTime: timestamp,
                initiator: { type: 'script' },
                type: 'XHR',
            }
        })
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
    
    DebuggerConnection.send({
        method: 'Network.responseReceived', 
        params: {
            requestId,
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
        }
    });
});

function convertBodyToString(body) {
    return new Promise((resolve) => {
      if (body instanceof Blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          // "data:image/png;base64,iVBORw0KGgo..." 에서 앞부분을 제거
          const base64String = reader.result.split(',')[1];
          resolve({ body: base64String, base64Encoded: true });
        };
        reader.onerror = () => resolve({ body: '[Could not read Blob]', base64Encoded: false });
        reader.readAsDataURL(body);
      } else if (body instanceof ArrayBuffer) {
        const uint8 = new Uint8Array(body);
        const charString = uint8.reduce((data, byte) => data + String.fromCharCode(byte), '');
        const base64String = btoa(charString);
        resolve({ body: base64String, base64Encoded: true });
      } else {
        // 일반 텍스트 또는 JSON 응답
        resolve({ body, base64Encoded: false });
      }
    });
}

// 5. DONE: `Network.loadingFinished` 또는 `Network.loadingFailed` 이벤트 발생
XHRInterceptor.setResponseCallback((status, timeout, response, responseURL, responseType, xhr) => {
    const requestId = xhrToRequestId.get(xhr);
    if (!requestId) return;

    const requestData = requests.get(requestId);
    const timestamp = Date.now() / 1000;

    // `response`가 Blob이나 ArrayBuffer일 수 있으므로 텍스트로 변환 시 주의
    if (requestData) {
        requestData.responseBody = response;
    }

    if (status > 0) {
        // 성공
        DebuggerConnection.send({
            method: 'Network.loadingFinished', 
            params: {
                requestId,
                timestamp,
                encodedDataLength: requestData?.encodedDataLength || response.length || 0,
            }
        });
    } else {
        // 실패 (네트워크 오류 등)
        DebuggerConnection.send({
            method: 'Network.loadingFailed', 
            params: {
                requestId,
                timestamp,
                type: 'XHR',
                errorText: 'Network request failed', // 실제 오류 메시지가 있다면 대체
                canceled: false,
            }
        });
    }

    // 작업 완료 후 데이터 정리 (선택 사항)
    // requests.delete(requestId);
});

// TODO: DebuggerConnection.addEventListener(handle{Specific}Message)
DebuggerConnection.addEventListener(async (payload) => {
    if (payload.method === 'Network.getResponseBody') {
        const requestId = payload.params.requestId;
        const requestData = requests.get(requestId);

        if (requestData && requestData.responseBody) {
            const result = await convertBodyToString(requestData.responseBody);
            DebuggerConnection.send({
                id: payload.id,
                result: result,
            })
        }
    }
})

XHRInterceptor.enableInterception();