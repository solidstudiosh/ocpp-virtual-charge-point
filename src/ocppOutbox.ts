import { OcppCall } from "./ocppMessage";

class OcppOutbox {
  private queue: Map<string, OcppCall<any>> = new Map();

  enqueue(ocppCall: OcppCall<any>) {
    this.queue.set(ocppCall.messageId, ocppCall);
  }

  get(messageId: string): OcppCall<any> | undefined {
    const enqueuedCall = this.queue.get(messageId);
    this.queue.delete(messageId);
    return enqueuedCall;
  }
}

export const ocppOutbox = new OcppOutbox();
