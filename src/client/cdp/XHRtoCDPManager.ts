import DebuggerConnection from '../DebuggerConnection';
import XHRInterceptor from '../interceptor/XHRInterceptor';
import { getId } from '../utils/id';
import { NativeModules } from 'react-native';
import { getHost } from '../utils/host';
import type { CDPMessage, GetResponseBodyResult } from '../../types/cdp';

interface RequestData {
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
  };
  responseBody?: unknown;
  encodedDataLength?: number;
}

// Map to temporarily store request information
// Key: requestId, Value: { request, responseBody, encodedDataLength }
const requests = new Map<string, RequestData>();

// WeakMap to map XMLHttpRequest instances to requestId
// Prevents memory leaks when XHR objects are garbage collected
// Key: XMLHttpRequest instance, Value: requestId
const xhrToRequestId = new WeakMap<XMLHttpRequest, string>();

const { host, port } = getHost();
const ignores = [`http://${host}:${port}/symbolicate`];

// Intercept XHR requests/responses and send CDP messages using DebuggerConnection.send
XHRInterceptor.setOpenCallback((method, url, xhr) => {
  if (ignores.includes(url)) {
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

// 2. setRequestHeader: Collect request headers
XHRInterceptor.setRequestHeaderCallback((header, value, xhr) => {
  const requestId = xhrToRequestId.get(xhr);
  if (!requestId) return;

  const data = requests.get(requestId);
  if (data) {
    data.request.headers[header] = value;
  }
});

// 3. send: Emit `Network.requestWillBeSent` event
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
      },
    });
  }
});

// 4. HEADERS_RECEIVED: Emit `Network.responseReceived` event
XHRInterceptor.setHeaderReceivedCallback((contentType, size, headersString, xhr) => {
  const requestId = xhrToRequestId.get(xhr);
  if (!requestId) return;

  const requestData = requests.get(requestId);
  if (requestData) {
    requestData.encodedDataLength = size || 0;
  }

  const headers: Record<string, string> = {};
  headersString
    .trim()
    .split(/[\r\n]+/)
    .forEach((line) => {
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
    },
  });
});

function convertBodyToString(
  body: unknown
): Promise<GetResponseBodyResult> {
  return new Promise((resolve) => {
    if (body instanceof Blob) {
      const reader = new FileReader();
      reader.onloadend = (): void => {
        // Remove prefix from "data:image/png;base64,iVBORw0KGgo..."
        const base64String = (reader.result as string).split(',')[1];
        resolve({ body: base64String, base64Encoded: true });
      };
      reader.onerror = (): void =>
        resolve({ body: '[Could not read Blob]', base64Encoded: false });
      reader.readAsDataURL(body);
    } else if (body instanceof ArrayBuffer) {
      const uint8 = new Uint8Array(body);
      const charString = uint8.reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      );
      const base64String = btoa(charString);
      resolve({ body: base64String, base64Encoded: true });
    } else {
      // Plain text or JSON response
      resolve({ body: String(body ?? ''), base64Encoded: false });
    }
  });
}

// 5. DONE: Emit `Network.loadingFinished` or `Network.loadingFailed` event
XHRInterceptor.setResponseCallback(
  (status, _timeout, response, _responseURL, _responseType, xhr) => {
    const requestId = xhrToRequestId.get(xhr);
    if (!requestId) return;

    const requestData = requests.get(requestId);
    const timestamp = Date.now() / 1000;

    // `response` could be Blob or ArrayBuffer, handle conversion carefully
    if (requestData) {
      requestData.responseBody = response;
    }

    if (status > 0) {
      // Success
      DebuggerConnection.send({
        method: 'Network.loadingFinished',
        params: {
          requestId,
          timestamp,
          encodedDataLength:
            requestData?.encodedDataLength ||
            (typeof response === 'string' ? response.length : 0) ||
            0,
        },
      });
    } else {
      // Failure (network error, etc.)
      DebuggerConnection.send({
        method: 'Network.loadingFailed',
        params: {
          requestId,
          timestamp,
          type: 'XHR',
          errorText: 'Network request failed',
          canceled: false,
        },
      });
    }

    // Cleanup after completion (optional)
    // requests.delete(requestId);
  }
);

// Handle getResponseBody requests from debugger
DebuggerConnection.addEventListener(async (payload: CDPMessage) => {
  if (payload.method === 'Network.getResponseBody') {
    const params = payload.params as { requestId: string } | undefined;
    const requestId = params?.requestId;
    if (!requestId) return;

    const requestData = requests.get(requestId);

    if (requestData && requestData.responseBody !== undefined) {
      const result = await convertBodyToString(requestData.responseBody);
      DebuggerConnection.send({
        id: payload.id,
        result: result,
      });
    }
  }
});

XHRInterceptor.enableInterception();
