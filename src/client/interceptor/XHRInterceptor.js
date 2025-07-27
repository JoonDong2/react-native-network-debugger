const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

let openCallback;
let sendCallback;
let requestHeaderCallback;
let headerReceivedCallback;
let responseCallback;

let isInterceptorEnabled = false;

/**
 * A network interceptor which monkey-patches XMLHttpRequest methods
 * to gather all network requests/responses, in order to show their
 * information in the React Native inspector development tool.
 * This supports interception with XMLHttpRequest API, including Fetch API
 * and any other third party libraries that depend on XMLHttpRequest.
 */
const XHRInterceptor = {
  setOpenCallback(callback) {
    openCallback = callback;
  },

  setSendCallback(callback) {
    sendCallback = callback;
  },

  setHeaderReceivedCallback(callback) {
    headerReceivedCallback = callback;
  },

  setResponseCallback(callback) {
    responseCallback = callback;
  },

  setRequestHeaderCallback(callback) {
    requestHeaderCallback = callback;
  },

  isInterceptorEnabled() {
    return isInterceptorEnabled;
  },

  enableInterception() {
    if (isInterceptorEnabled) {
      return;
    }
    XMLHttpRequest.prototype.open = function (method, url) {
      if (openCallback) {
        openCallback(method, url, this);
      }
      originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
      if (requestHeaderCallback) {
        requestHeaderCallback(header, value, this);
      }
      originalXHRSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (data) {
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
              let responseContentType, responseSize;
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
                  this,
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
                  this,
                );
              }
            }
          },
          false,
        );
      }
      originalXHRSend.apply(this, arguments);
    };
    isInterceptorEnabled = true;
  },

  disableInterception() {
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
