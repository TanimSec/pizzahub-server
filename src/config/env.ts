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
  IMAGE_PROVIDER: z.enum(["auto", "imgbb", "cloudinary"]).default("auto"),
  IMGBB_API_KEY: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = schema
  .superRefine((v, ctx) => {
    if (v.IMAGE_PROVIDER === "imgbb" && !v.IMGBB_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["IMGBB_API_KEY"], message: "Required when IMAGE_PROVIDER=imgbb" });
    }
    if (v.IMAGE_PROVIDER === "cloudinary" || v.IMAGE_PROVIDER === "auto") {
      for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const) {
        if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: "Required when IMAGE_PROVIDER is cloudinary or auto" });
      }
    }
  })
  .safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}
export const env = parsed.data;
