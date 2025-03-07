import "dotenv/config";
import fastify from "fastify";
import {
  changeVcpStatus,
  getVcpStatus,
  startVcp,
  stopVcp,
} from "./controllers/chargePointController";
import {
  ChangeVcpStatusValidationSchema,
  StartVcpValidationSchema,
  StatusValidationSchema,
  StopVcpValidationSchema,
} from "./schema";

const app = fastify({
  logger: true,
});

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

app.post(
  "/api/vcp/start",
  {
    schema: {
      body: StartVcpValidationSchema,
    },
  },
  startVcp,
);
app.post(
  "/api/vcp/stop",
  { schema: { body: StopVcpValidationSchema } },
  stopVcp,
);
app.get(
  "/api/vcp/status",
  {
    schema: {
      querystring: StatusValidationSchema,
    },
  },
  getVcpStatus,
);
app.post(
  "/api/vcp/change-status",
  {
    schema: {
      body: ChangeVcpStatusValidationSchema,
    },
  },
  changeVcpStatus,
);

const start = async () => {
  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);

    process.exit(1);
  }
};

start();
