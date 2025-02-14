import WebSocket from "ws";
require("dotenv").config();

import type { OcppCall } from "../src/ocppMessage";

const adminWsPort = process.env.ADMIN_PORT ?? "9999";
const adminWs = new WebSocket(`ws://localhost:${adminWsPort}`);

// biome-ignore lint/suspicious/noExplicitAny: ocpp types
export const sendAdminCommand = (command: OcppCall<any>) => {
  adminWs.on("open", () => {
    adminWs.send(JSON.stringify(command));
    adminWs.close();
  });
};
