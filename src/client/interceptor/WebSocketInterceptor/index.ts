/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import { NativeEventEmitter, Platform, type EmitterSubscription } from 'react-native';
import NativeWebSocketModule from './NativeWebSocketModule';
import base64 from 'base64-js';
import type {
  WebSocketConnectCallback,
  WebSocketSendCallback,
  WebSocketCloseCallback,
  WebSocketOnOpenCallback,
  WebSocketOnMessageCallback,
  WebSocketOnErrorCallback,
  WebSocketOnCloseCallback,
} from '../../../types/interceptor';

const originalRCTWebSocketConnect = NativeWebSocketModule.connect;
const originalRCTWebSocketSend = NativeWebSocketModule.send;
const originalRCTWebSocketSendBinary = NativeWebSocketModule.sendBinary;
const originalRCTWebSocketClose = NativeWebSocketModule.close;

let eventEmitter: NativeEventEmitter | null = null;
let subscriptions: EmitterSubscription[] = [];

let closeCallback: WebSocketCloseCallback | null = null;
let sendCallback: WebSocketSendCallback | null = null;
let connectCallback: WebSocketConnectCallback | null = null;
let onOpenCallback: WebSocketOnOpenCallback | null = null;
let onMessageCallback: WebSocketOnMessageCallback | null = null;
let onErrorCallback: WebSocketOnErrorCallback | null = null;
let onCloseCallback: WebSocketOnCloseCallback | null = null;

let isInterceptorEnabled = false;

/**
 * A network interceptor which monkey-patches RCTWebSocketModule methods
 * to gather all websocket network requests/responses, in order to show
 * their information in the React Native inspector development tool.
 */

const WebSocketInterceptor = {
  /**
   * Invoked when RCTWebSocketModule.close(...) is called.
   */
  setCloseCallback(callback: WebSocketCloseCallback): void {
    closeCallback = callback;
  },

  /**
   * Invoked when RCTWebSocketModule.send(...) or sendBinary(...) is called.
   */
  setSendCallback(callback: WebSocketSendCallback): void {
    sendCallback = callback;
  },

  /**
   * Invoked when RCTWebSocketModule.connect(...) is called.
   */
  setConnectCallback(callback: WebSocketConnectCallback): void {
    connectCallback = callback;
  },

  /**
   * Invoked when event "websocketOpen" happens.
   */
  setOnOpenCallback(callback: WebSocketOnOpenCallback): void {
    onOpenCallback = callback;
  },

  /**
   * Invoked when event "websocketMessage" happens.
   */
  setOnMessageCallback(callback: WebSocketOnMessageCallback): void {
    onMessageCallback = callback;
  },

  /**
   * Invoked when event "websocketFailed" happens.
   */
  setOnErrorCallback(callback: WebSocketOnErrorCallback): void {
    onErrorCallback = callback;
  },

  /**
   * Invoked when event "websocketClosed" happens.
   */
  setOnCloseCallback(callback: WebSocketOnCloseCallback): void {
    onCloseCallback = callback;
  },

  isInterceptorEnabled(): boolean {
    return isInterceptorEnabled;
  },

  _unregisterEvents(): void {
    subscriptions.forEach((e) => e.remove());
    subscriptions = [];
  },

  /**
   * Add listeners to the RCTWebSocketModule events to intercept them.
   */
  _registerEvents(): void {
    subscriptions = [
      eventEmitter!.addListener('websocketMessage', (event: unknown) => {
        const ev = event as { id: number; type: string; data: string };
        if (onMessageCallback) {
          onMessageCallback(
            ev.id,
            ev.type === 'binary'
              ? WebSocketInterceptor._arrayBufferToString(ev.data)
              : ev.data
          );
        }
      }),
      eventEmitter!.addListener('websocketOpen', (event: unknown) => {
        const ev = event as { id: number };
        if (onOpenCallback) {
          onOpenCallback(ev.id);
        }
      }),
      eventEmitter!.addListener('websocketClosed', (event: unknown) => {
        const ev = event as { id: number; code: number; reason: string };
        if (onCloseCallback) {
          onCloseCallback(ev.id, { code: ev.code, reason: ev.reason });
        }
      }),
      eventEmitter!.addListener('websocketFailed', (event: unknown) => {
        const ev = event as { id: number; message: string };
        if (onErrorCallback) {
          onErrorCallback(ev.id, { message: ev.message });
        }
      }),
    ];
  },

  enableInterception(): void {
    if (isInterceptorEnabled) {
      return;
    }
    eventEmitter = new NativeEventEmitter(
      // T88715063: NativeEventEmitter only used this parameter on iOS. Now it uses it on all platforms, so this code was modified automatically to preserve its behavior
      // If you want to use the native module on other platforms, please remove this condition and test its behavior
      Platform.OS !== 'ios' ? null : (NativeWebSocketModule as unknown)
    );
    WebSocketInterceptor._registerEvents();

    // Override `connect` method for all RCTWebSocketModule requests
    // to intercept the request url, protocols, options and socketId,
    // then pass them through the `connectCallback`.
    NativeWebSocketModule.connect = function (
      url: string,
      protocols: string[] | null,
      options: { headers?: Record<string, string> } | null,
      socketId: number
    ): void {
      if (connectCallback) {
        connectCallback(url, protocols, options, socketId);
      }
      originalRCTWebSocketConnect.apply(this, arguments as unknown as Parameters<typeof originalRCTWebSocketConnect>);
    };

    // Override `send` method for all RCTWebSocketModule requests to intercept
    // the data sent, then pass them through the `sendCallback`.
    NativeWebSocketModule.send = function (data: string, socketId: number): void {
      if (sendCallback) {
        sendCallback(data, socketId);
      }
      originalRCTWebSocketSend.apply(this, arguments as unknown as Parameters<typeof originalRCTWebSocketSend>);
    };

    // Override `sendBinary` method for all RCTWebSocketModule requests to
    // intercept the data sent, then pass them through the `sendCallback`.
    NativeWebSocketModule.sendBinary = function (data: string, socketId: number): void {
      if (sendCallback) {
        sendCallback(WebSocketInterceptor._arrayBufferToString(data), socketId);
      }
      originalRCTWebSocketSendBinary.apply(this, arguments as unknown as Parameters<typeof originalRCTWebSocketSendBinary>);
    };

    // Override `close` method for all RCTWebSocketModule requests to intercept
    // the close information, then pass them through the `closeCallback`.
    NativeWebSocketModule.close = function (...args: [number?, string?, number?]): void {
      if (closeCallback) {
        if (args.length === 3) {
          closeCallback(args[0] ?? null, args[1] ?? null, args[2]!);
        } else {
          closeCallback(null, null, args[0] as number);
        }
      }
      originalRCTWebSocketClose.apply(this, args);
    };

    isInterceptorEnabled = true;
  },

  _arrayBufferToString(data: string): string {
    const value = base64.toByteArray(data).buffer;
    if (value === undefined || value === null) {
      return '(no value)';
    }
    if (
      typeof ArrayBuffer !== 'undefined' &&
      typeof Uint8Array !== 'undefined' &&
      value instanceof ArrayBuffer
    ) {
      return `ArrayBuffer {${String(Array.from(new Uint8Array(value)))}}`;
    }
    return String(value);
  },

  // Unpatch RCTWebSocketModule methods and remove the callbacks.
  disableInterception(): void {
    if (!isInterceptorEnabled) {
      return;
    }
    isInterceptorEnabled = false;
    NativeWebSocketModule.send = originalRCTWebSocketSend;
    NativeWebSocketModule.sendBinary = originalRCTWebSocketSendBinary;
    NativeWebSocketModule.close = originalRCTWebSocketClose;
    NativeWebSocketModule.connect = originalRCTWebSocketConnect;

    connectCallback = null;
    closeCallback = null;
    sendCallback = null;
    onOpenCallback = null;
    onMessageCallback = null;
    onCloseCallback = null;
    onErrorCallback = null;

    WebSocketInterceptor._unregisterEvents();
  },
};

export default WebSocketInterceptor;
