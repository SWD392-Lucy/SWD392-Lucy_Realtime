import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  LUCY_JWT_ISSUER: z.string().default("lucy.identity"),
  LUCY_JWT_AUDIENCE: z.string().default("lucy.clients"),
  LUCY_JWT_SIGNING_KEY: z.string().min(16),
  AUTH_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  IDENTITY_SERVICE_URL: z.string().url().default("http://localhost:5095"),
  AGORA_APP_ID: z.string().optional().default(""),
  AGORA_APP_CERTIFICATE: z.string().optional().default(""),
  AGORA_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  DISCONNECT_GRACE_SECONDS: z.coerce.number().int().positive().default(180),
  PRESENCE_SWEEP_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:3000")
});

export const env = envSchema.parse(process.env);

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const hasAgoraConfig = Boolean(env.AGORA_APP_ID && env.AGORA_APP_CERTIFICATE);
