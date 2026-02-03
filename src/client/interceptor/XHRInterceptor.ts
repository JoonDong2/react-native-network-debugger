import type {
  XHROpenCallback,
  XHRSendCallback,
  XHRRequestHeaderCallback,
  XHRHeaderReceivedCallback,
  XHRResponseCallback,
} from '../../types/interceptor';

const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

let openCallback: XHROpenCallback | null = null;
let sendCallback: XHRSendCallback | null = null;
let requestHeaderCallback: XHRRequestHeaderCallback | null = null;
let headerReceivedCallback: XHRHeaderReceivedCallback | null = null;
let responseCallback: XHRResponseCallback | null = null;

let isInterceptorEnabled = false;

/**
 * A network interceptor which monkey-patches XMLHttpRequest methods
 * to gather all network requests/responses, in order to show their
 * information in the React Native inspector development tool.
 * This supports interception with XMLHttpRequest API, including Fetch API
 * and any other third party libraries that depend on XMLHttpRequest.
 */
const XHRInterceptor = {
  setOpenCallback(callback: XHROpenCallback): void {
    openCallback = callback;
  },

  setSendCallback(callback: XHRSendCallback): void {
    sendCallback = callback;
  },

  setHeaderReceivedCallback(callback: XHRHeaderReceivedCallback): void {
    headerReceivedCallback = callback;
  },

  setResponseCallback(callback: XHRResponseCallback): void {
    responseCallback = callback;
  },

  setRequestHeaderCallback(callback: XHRRequestHeaderCallback): void {
    requestHeaderCallback = callback;
  },

  isInterceptorEnabled(): boolean {
    return isInterceptorEnabled;
  },

  enableInterception(): void {
    if (isInterceptorEnabled) {
      return;
    }
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL
    ): void {
      if (openCallback) {
        openCallback(method, url.toString(), this);
      }
      originalXHROpen.apply(this, arguments as unknown as Parameters<typeof originalXHROpen>);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (
      this: XMLHttpRequest,
      header: string,
      value: string
    ): void {
      if (requestHeaderCallback) {
        requestHeaderCallback(header, value, this);
      }
      originalXHRSetRequestHeader.apply(this, arguments as unknown as Parameters<typeof originalXHRSetRequestHeader>);
    };

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest,
      data?: Document | XMLHttpRequestBodyInit | null
    ): void {
      if (sendCallback) {
        sendCallback(data, this);
      }
      if (this.addEventListener) {
        this.addEventListener(
          'readystatechange',
          () => {
            if (!isInterceptorEnabled) {
              return;
            }
            if (this.readyState === this.HEADERS_RECEIVED) {
              const contentTypeString = this.getResponseHeader('Content-Type');
              const contentLengthString = this.getResponseHeader('Content-Length');
              let responseContentType: string | undefined;
              let responseSize: number | undefined;
              if (contentTypeString) {
                responseContentType = contentTypeString.split(';')[0];
              }
              if (contentLengthString) {
                responseSize = parseInt(contentLengthString, 10);
              }
              if (headerReceivedCallback) {
                headerReceivedCallback(
                  responseContentType,
                  responseSize,
                  this.getAllResponseHeaders(),
                  this
                );
              }
            }
            if (this.readyState === this.DONE) {
              if (responseCallback) {
                responseCallback(
                  this.status,
                  this.timeout,
                  this.response,
                  this.responseURL,
                  this.responseType,
                  this
                );
              }
            }
          },
          false
        );
      }
      originalXHRSend.apply(this, arguments as unknown as Parameters<typeof originalXHRSend>);
    };
    isInterceptorEnabled = true;
  },

  disableInterception(): void {
    if (!isInterceptorEnabled) {
      return;
    }
    isInterceptorEnabled = false;
    XMLHttpRequest.prototype.send = originalXHRSend;
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.setRequestHeader = originalXHRSetRequestHeader;
    responseCallback = null;
    openCallback = null;
    sendCallback = null;
    headerReceivedCallback = null;
    requestHeaderCallback = null;
  },
};

export default XHRInterceptor;
