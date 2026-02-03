/**
 * Chrome DevTools Protocol (CDP) types
 */

export interface CDPMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: CDPError;
}

export interface CDPError {
  code: number;
  message: string;
  data?: unknown;
}

export interface CDPRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
}

export interface CDPResponse {
  url?: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType?: string;
  connectionReused?: boolean;
  connectionId?: number;
  fromDiskCache?: boolean;
  fromServiceWorker?: boolean;
  encodedDataLength?: number;
  securityState?: string;
}

export interface NetworkRequestWillBeSentParams {
  requestId: string;
  documentURL?: string;
  request: CDPRequest;
  timestamp: number;
  wallTime: number;
  initiator: { type: string };
  type: string;
}

export interface NetworkResponseReceivedParams {
  requestId: string;
  timestamp: number;
  type: string;
  response: CDPResponse;
}

export interface NetworkLoadingFinishedParams {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
}

export interface NetworkLoadingFailedParams {
  requestId: string;
  timestamp: number;
  type: string;
  errorText: string;
  canceled: boolean;
}

export interface WebSocketFrame {
  opcode: number;
  mask: boolean;
  payloadData: string;
}

export interface WebSocketHandshakeParams {
  requestId: string;
  timestamp: number;
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
  };
}

export interface WebSocketFrameParams {
  requestId: string;
  timestamp: number;
  response: WebSocketFrame;
}

export interface WebSocketClosedParams {
  requestId: string;
  timestamp: number;
  code?: number;
  reason?: string;
}

export interface WebSocketErrorParams {
  requestId: string;
  timestamp: number;
  errorMessage: string;
}

export interface GetResponseBodyResult {
  body: string;
  base64Encoded: boolean;
}
