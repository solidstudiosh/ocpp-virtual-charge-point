require("dotenv").config();

import type { OcppCall } from "../src/ocppMessage";

const adminPort = process.env.ADMIN_PORT ?? "9999";

// biome-ignore lint/suspicious/noExplicitAny: ocpp types
export const sendAdminCommand = async (command: OcppCall<any>) => {
  await fetch(`http://localhost:${adminPort}/execute`, {
    method: "POST",
    body: JSON.stringify({
      action: command.action,
      payload: command.payload,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
};
