const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

let openCallback;
let sendCallback;
let requestHeaderCallback;
let headerReceivedCallback;
let responseCallback;

let dataReceivedCallback; // 청크 데이터 수신 콜백
let lastResponseLength = 0; // 마지막으로 받은 데이터 길이를 추적

let isInterceptorEnabled = false;

/**
 * A network interceptor which monkey-patches XMLHttpRequest methods
 * to gather all network requests/responses, in order to show their
 * information in the React Native inspector development tool.
 * This supports interception with XMLHttpRequest API, including Fetch API
 * and any other third party libraries that depend on XMLHttpRequest.
 */
const XHRInterceptor = {
  /**
   * Invoked before XMLHttpRequest.open(...) is called.
   */
  setOpenCallback(callback) {
    openCallback = callback;
  },

  /**
   * Invoked before XMLHttpRequest.send(...) is called.
   */
  setSendCallback(callback) {
    sendCallback = callback;
  },

  /**
   * Invoked after xhr's readyState becomes xhr.HEADERS_RECEIVED.
   */
  setHeaderReceivedCallback(callback) {
    headerReceivedCallback = callback;
  },

  /**
   * Invoked after xhr's readyState becomes xhr.DONE.
   */
  setResponseCallback(callback) {
    responseCallback = callback;
  },

  /**
   * Invoked before XMLHttpRequest.setRequestHeader(...) is called.
   */
  setRequestHeaderCallback(callback) {
    requestHeaderCallback = callback;
  },


  setDataReceivedCallback(callback) { // 새로운 콜백 설정 함수
    dataReceivedCallback = callback;
  },

  isInterceptorEnabled() {
    return isInterceptorEnabled;
  },

  enableInterception() {
    if (isInterceptorEnabled) {
      return;
    }
    // Override `open` method for all XHR requests to intercept the request
    // method and url, then pass them through the `openCallback`.
    XMLHttpRequest.prototype.open = function (method, url) {
      if (openCallback) {
        openCallback(method, url, this);
      }
      originalXHROpen.apply(this, arguments);
    };

    // Override `setRequestHeader` method for all XHR requests to intercept
    // the request headers, then pass them through the `requestHeaderCallback`.
    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
      if (requestHeaderCallback) {
        requestHeaderCallback(header, value, this);
      }
      originalXHRSetRequestHeader.apply(this, arguments);
    };

    // Override `send` method of all XHR requests to intercept the data sent,
    // register listeners to intercept the response, and invoke the callbacks.
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
              const contentLengthString =
                this.getResponseHeader('Content-Length');
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
            // 청크 데이터 처리
            if (this.readyState === this.LOADING) { 
              if (dataReceivedCallback) {
                // this.responseText는 항상 누적된 전체 텍스트입니다.
                const newResponseText = this.responseText.substring(lastResponseLength);
                lastResponseLength = this.responseText.length;
                dataReceivedCallback(newResponseText, this);
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

  // Unpatch XMLHttpRequest methods and remove the callbacks.
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

module.exports = XHRInterceptor;
