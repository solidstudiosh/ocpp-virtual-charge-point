import "dotenv/config";
import fastify, { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import { authRoutes } from "./routes/auth";
import fastifyJwt from "@fastify/jwt";
import fastifyAuth from "@fastify/auth";
import { chargePointRoutes } from "./routes/charge-point";
import fastifyStatic from "@fastify/static";
import path from "path";

const app = fastify({
  logger: true,
});

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

app.register(fastifyStatic, {
  root: path.join(__dirname, "../public"),
});

app.register(fastifyJwt, { secret: process.env.JWT_SECRET || "secret" });

app
  .decorate(
    "verifyJwt",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    },
  )
  .register(fastifyAuth)
  .after(() => {
    app.register(chargePointRoutes, { prefix: "/api/vcp/" });
    app.register(authRoutes);

    app.get("/control", async (request, reply) => {
      return reply.sendFile("control.html");
    });
  });

app.get("/health", async (request, reply) => {
  return reply.send("OK");
});

const start = async () => {
  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);

    process.exit(1);
  }
};

start();
