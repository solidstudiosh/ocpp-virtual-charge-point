import { FastifyRequest, FastifyReply } from "fastify";
import { LoginRequestSchema } from "../schema";

const users = {
  password: process.env.USERS_PASSWORD,
  users: [
    {
      first_name: "User",
      email: "em",
    },
    {
      first_name: "Alan",
      email: "alan@electricmiles.co.uk",
    },
    {
      first_name: "Chimezie",
      email: "chimezie@electricmiles.co.uk",
    },
  ],
};

export const login = async (
  request: FastifyRequest<{ Body: LoginRequestSchema }>,
  reply: FastifyReply,
) => {
  const { email, password } = request.body;

  if (email == "" || password == "") {
    return reply.status(401).send({
      status: "error",
      message: "Invalid username or password",
    });
  }

  if (password !== users.password) {
    return reply.status(401).send({
      status: "error",
      message: "Invalid username or password",
    });
  }

  const user = users.users.find((user) => user.email === email);

  if (!user) {
    return reply.status(401).send({
      status: "error",
      message: "Invalid username or password",
    });
  }

  const token = await reply.jwtSign(user);

  return reply.send({
    status: "success",
    message: "Logged in successfully",
    data: {
      access_token: token,
    },
  });
};

export async function user(request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    status: "success",
    message: "User retrieved successfully",
    data: request.user,
  });
}
