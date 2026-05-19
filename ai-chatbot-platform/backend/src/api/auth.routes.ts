import type { FastifyInstance } from "fastify";
import { prisma } from "../config/prisma.js";
import { createHash } from "node:crypto";

function hash(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (request, reply) => {
    const body = request.body as { email: string; password: string; name?: string };
    const user = await prisma.user.create({ data: { email: body.email, passwordHash: hash(body.password), name: body.name } });
    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = request.body as { email: string; password: string };
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || user.passwordHash !== hash(body.password)) return reply.code(401).send({ message: "Invalid credentials" });
    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name } });
  });
}
