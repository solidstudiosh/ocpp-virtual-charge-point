import type { OcppCall, OcppCallError } from "../ocppMessage";

/**
 * What a transport hands back to the VCP. Calls are dispatched synchronously,
 * so an exception thrown by a handler surfaces where the transport received
 * the message.
 */
export interface OcppTransportHandlers {
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  onCall: (call: OcppCall<any>) => void;
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  onCallResult: (messageId: string, payload: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  onCallError: (error: OcppCallError<any>) => void;
  onClose: (code: number, reason: string) => void;
  onError: (error: Error) => void;
}

/**
 * The wire between the VCP and the central system: framing, encoding and the
 * connection. Message semantics (outbox, handlers, validation) stay in the VCP.
 */
export interface OcppTransport {
  connect(handlers: OcppTransportHandlers): Promise<void>;
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  sendCall(call: OcppCall<any>): void;
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  sendCallResult(messageId: string, action: string, payload: any): void;
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  sendCallError(error: OcppCallError<any>): void;
  close(): void;
}
