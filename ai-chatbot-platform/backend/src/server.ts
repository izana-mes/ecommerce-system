import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import authPlugin from "./auth/auth.plugin.js";
import { env } from "./utils/env.js";
import { logger } from "./utils/logger.js";
import { authRoutes } from "./api/auth.routes.js";
import { chatRoutes } from "./api/chat.routes.js";
import { ragRoutes } from "./api/rag.routes.js";

const app = Fastify({ logger });

await app.register(cors, { origin: env.APP_ORIGIN, credentials: true });
await app.register(sensible);
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await app.register(authPlugin);

app.get("/health", async () => ({ ok: true }));
await app.register(authRoutes, { prefix: "/api" });
await app.register(chatRoutes, { prefix: "/api" });
await app.register(ragRoutes, { prefix: "/api" });

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  return reply.code(error.statusCode ?? 500).send({ message: error.message });
});

await app.listen({ host: "0.0.0.0", port: env.PORT });
