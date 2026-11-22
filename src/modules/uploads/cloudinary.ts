import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

interface CloudinaryResponse {
  secure_url?: string;
  error?: { message?: string };
}

/** Cloudinary signature: sha1 of the sorted "key=value" params joined by "&", followed by the API secret. */
export function signParams(params: Record<string, string | number>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + secret).digest("hex");
}

export async function uploadToCloudinary(buffer: Buffer, filename: string, mime: string): Promise<string> {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = env;
  if (!cloud || !apiKey || !secret) throw new ApiError(500, "Image upload is not configured");

  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { folder: "pizzahub", timestamp };

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), filename);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", signed.folder);
  form.append("signature", signParams(signed, secret));

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new ApiError(502, "Image host is unreachable. Please try again.");
  }
  const json = (await res.json().catch(() => ({}))) as CloudinaryResponse;
  if (!res.ok || !json.secure_url) {
    throw new ApiError(502, json.error?.message ?? "Image upload failed");
  }
  return json.secure_url;
}
