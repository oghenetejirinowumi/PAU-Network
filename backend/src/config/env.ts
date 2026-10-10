import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  /** Max pooled connections. Set to 1 for the single-connection local `prisma dev` server. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
  LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().default("http://localhost:4000/api/v1/auth/linkedin/callback"),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  LIVEKIT_URL: z.string().url().optional(),
  LIVEKIT_API_KEY: z.string().min(1).optional(),
  LIVEKIT_API_SECRET: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);

/** "*" allows any origin (useful for demos); otherwise a comma-separated allow-list. */
export const corsOrigins: true | string[] = env.CORS_ORIGINS.trim() === "*" ? true : env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
