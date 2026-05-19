import Redis from "ioredis";
import { env } from "../utils/env.js";

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
