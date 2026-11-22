import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.string().default("development"),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().default("pizzahub"),
  CLIENT_URL: z.string().url(),
  AUTH_JWKS_URL: z.string().url(),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PREMIUM_PRICE_ID: z.string().min(1),
  IMGBB_API_KEY: z.string().min(1),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}
export const env = parsed.data;
