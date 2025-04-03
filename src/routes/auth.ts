import { FastifyInstance } from "fastify";
import { login, user } from "../controllers/authController";
import fs from "fs";
import { LoginValidationSchema } from "../schema";

export async function authRoutes(app: FastifyInstance) {
  app.get("/login", async (request, reply) => {
    return reply.sendFile("login.html");
  });

  app.post(
    "/api/auth/login",
    {
      schema: {
        body: LoginValidationSchema,
      },
    },
    login,
  );

  app.get("/api/auth/user", { preHandler: app.auth([app.verifyJwt]) }, user);
}
