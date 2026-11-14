import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, it, mock } from "node:test";
import { logger } from "../logger";
import type { OcppTransportHandlers } from "./ocppTransport";
import { WsJsonTransport } from "./wsJsonTransport";

const PASSWORD = "not-a-real-password";

/** A proxy that refuses every WebSocket upgrade with the given status line. */
const refusingProxy = (statusLine: string): Promise<Server> =>
  new Promise((resolve) => {
    const server = createServer();
    server.on("upgrade", (_request, socket) => {
      socket.end(`HTTP/1.1 ${statusLine}\r\nContent-Length: 0\r\n\r\n`);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });

/** Connects and resolves once the transport reported the error and the close. */
const connectUntilClosed = (endpoint: string) =>
  new Promise<{ errors: Error[]; closes: number[] }>((resolve) => {
    const errors: Error[] = [];
    const closes: number[] = [];
    const handlers: OcppTransportHandlers = {
      onCall: () => {},
      onCallResult: () => {},
      onCallError: () => {},
      onError: (error) => errors.push(error),
      onClose: (code) => {
        closes.push(code);
        resolve({ errors, closes });
      },
    };
    new WsJsonTransport({
      endpoint,
      chargePointId: "CP-1",
      protocol: "ocpp1.6",
      basicAuthPassword: PASSWORD,
    }).connect(handlers);
  });

const loggedErrors = () => {
  const spy = mock.method(logger, "error", () => logger);
  return () => spy.mock.calls.map((c) => String(c.arguments[0]));
};

describe("WsJsonTransport errors", () => {
  let server: Server | undefined;
  afterEach(() => {
    mock.restoreAll();
    server?.close();
    server = undefined;
  });

  it("logs the HTTP status of a refused handshake, not undefined", async () => {
    server = await refusingProxy("401 Unauthorized");
    const { port } = server.address() as AddressInfo;
    const lines = loggedErrors();

    const { errors, closes } = await connectUntilClosed(
      `ws://127.0.0.1:${port}`,
    );

    assert.deepEqual(lines(), [
      "Websocket error: Unexpected server response: 401 Unauthorized",
    ]);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /401 Unauthorized/);
    assert.equal(closes.length, 1);
    const logged = lines().join("\n");
    assert.ok(!logged.includes(PASSWORD));
    assert.ok(!logged.includes("Basic "));
  });

  it("logs the error code of a refused connection", async () => {
    server = await refusingProxy("401 Unauthorized");
    const { port } = server.address() as AddressInfo;
    await new Promise((r) => server?.close(r));
    server = undefined;
    const lines = loggedErrors();

    const { errors, closes } = await connectUntilClosed(
      `ws://127.0.0.1:${port}`,
    );

    assert.equal(lines().length, 1);
    assert.match(lines()[0], /^Websocket error: .*ECONNREFUSED/);
    assert.ok(!lines()[0].includes("undefined"));
    assert.equal(errors.length, 1);
    assert.equal(closes.length, 1);
  });
});
