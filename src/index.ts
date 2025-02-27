import "dotenv/config";
import {
  changeVcpStatus,
  getVcpStatus,
  startVcp,
  stopVcp,
} from "./controllers/chargePointController";

const fastify = require("fastify")({
  logger: true,
});

const host = process.env.HOST || "0.0.0.0";
const port = process.env.PORT || 3000;

fastify.post("/api/vcp/start", startVcp);
fastify.post("/api/vcp/stop", stopVcp);
fastify.get("/api/vcp/status", getVcpStatus);
fastify.post("/api/vcp/change-status", changeVcpStatus);

const start = async () => {
  try {
    await fastify.listen({ host, port });
  } catch (err) {
    fastify.log.error(err);

    process.exit(1);
  }
};

start();
