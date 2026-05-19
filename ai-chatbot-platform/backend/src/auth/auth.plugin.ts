import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

export default fp(async function authPlugin(app: FastifyInstance) {
  app.register(import("@fastify/jwt"), { secret: process.env.JWT_SECRET ?? "replace-me-please" });

  app.decorate("authenticate", async function authenticate(request: any) {
    await request.jwtVerify();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}
