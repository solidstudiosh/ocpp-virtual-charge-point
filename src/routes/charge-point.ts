import { FastifyInstance } from "fastify";
import {
  startVcp,
  stopVcp,
  getVcpStatus,
  changeVcpStatus,
} from "../controllers/chargePointController";
import {
  StartVcpValidationSchema,
  StopVcpValidationSchema,
  StatusValidationSchema,
  ChangeVcpStatusValidationSchema,
} from "../schema";

export async function chargePointRoutes(app: FastifyInstance) {
  app.post(
    "start",
    {
      schema: {
        body: StartVcpValidationSchema,
      },
      preHandler: app.auth([app.verifyJwt]),
    },
    startVcp,
  );
  app.post(
    "stop",
    {
      schema: { body: StopVcpValidationSchema },
      preHandler: app.auth([app.verifyJwt]),
    },
    stopVcp,
  );
  app.get(
    "status",
    {
      schema: {
        querystring: StatusValidationSchema,
      },
      preHandler: app.auth([app.verifyJwt]),
    },
    getVcpStatus,
  );
  app.post(
    "change-status",
    {
      schema: {
        body: ChangeVcpStatusValidationSchema,
      },
      preHandler: app.auth([app.verifyJwt]),
    },
    changeVcpStatus,
  );
}
