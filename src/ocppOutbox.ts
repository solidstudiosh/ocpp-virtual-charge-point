import type { OcppCall } from "./ocppMessage";

class OcppOutbox {
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  private queue: Map<string, OcppCall<any>> = new Map();

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  enqueue(ocppCall: OcppCall<any>) {
    this.queue.set(ocppCall.messageId, ocppCall);
  }

  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  get(messageId: string): OcppCall<any> | undefined {
    const enqueuedCall = this.queue.get(messageId);
    this.queue.delete(messageId);
    return enqueuedCall;
  }
}

export const ocppOutbox = new OcppOutbox();
