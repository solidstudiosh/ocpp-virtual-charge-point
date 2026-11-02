import type { OcppCall, OcppCallError } from "../ocppMessage";

/**
 * What a transport hands back to the VCP. Every `onCall` must be answered
 * exactly once, by `sendCallResult` or `sendCallError` with its messageId.
 * `onClose` and `onError` mean the connection is gone (the VCP restarts or
 * exits); a transport reports them at most once and reports the failure of a
 * single request through `onCallError` instead.
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
 *
 * `beforeWrite` runs after the message is encoded and logged and before it is
 * written; if it throws, nothing is written.
 */
export interface OcppTransport {
  connect(handlers: OcppTransportHandlers): Promise<void>;
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  sendCall(call: OcppCall<any>, beforeWrite?: () => void): void;
  sendCallResult(
    messageId: string,
    action: string,
    // biome-ignore lint/suspicious/noExplicitAny: ocpp types
    payload: any,
    beforeWrite?: () => void,
  ): void;
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  sendCallError(error: OcppCallError<any>): void;
  close(): void;
}
