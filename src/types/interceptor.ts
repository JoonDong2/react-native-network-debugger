/**
 * Interceptor callback types
 */

/**
 * XHR open callback
 */
export type XHROpenCallback = (
  method: string,
  url: string,
  xhr: XMLHttpRequest
) => void;

/**
 * XHR send callback
 */
export type XHRSendCallback = (
  data: Document | XMLHttpRequestBodyInit | null | undefined,
  xhr: XMLHttpRequest
) => void;

/**
 * XHR request header callback
 */
export type XHRRequestHeaderCallback = (
  header: string,
  value: string,
  xhr: XMLHttpRequest
) => void;

/**
 * XHR header received callback
 */
export type XHRHeaderReceivedCallback = (
  contentType: string | undefined,
  size: number | undefined,
  headersString: string,
  xhr: XMLHttpRequest
) => void;

/**
 * XHR response callback
 */
export type XHRResponseCallback = (
  status: number,
  timeout: number,
  response: unknown,
  responseURL: string,
  responseType: XMLHttpRequestResponseType,
  xhr: XMLHttpRequest
) => void;

/**
 * WebSocket connect callback
 */
export type WebSocketConnectCallback = (
  url: string,
  protocols: string[] | null,
  options: { headers?: Record<string, string> } | null,
  socketId: number
) => void;

/**
 * WebSocket send callback
 */
export type WebSocketSendCallback = (data: string, socketId: number) => void;

/**
 * WebSocket close callback
 */
export type WebSocketCloseCallback = (
  code: number | null,
  reason: string | null,
  socketId: number
) => void;

/**
 * WebSocket open callback
 */
export type WebSocketOnOpenCallback = (socketId: number) => void;

/**
 * WebSocket message callback
 */
export type WebSocketOnMessageCallback = (
  socketId: number,
  data: string
) => void;

/**
 * WebSocket error callback
 */
export type WebSocketOnErrorCallback = (
  socketId: number,
  error: { message: string }
) => void;

/**
 * WebSocket close event callback
 */
export type WebSocketOnCloseCallback = (
  socketId: number,
  closeData: { code: number; reason: string }
) => void;
