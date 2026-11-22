import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

interface ImgbbResponse {
  success?: boolean;
  data?: { display_url?: string; url?: string };
  error?: { message?: string };
}

export async function uploadToImgbb(buffer: Buffer, filename: string, mime: string): Promise<string> {
  const apiKey = env.IMGBB_API_KEY;
  if (!apiKey) throw new ApiError(500, "Image upload is not configured");
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(buffer)], { type: mime }), filename);
  let res: Response;
  try {
    res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError(502, "Image host is unreachable. Please try again.");
  }
  const json = (await res.json().catch(() => ({}))) as ImgbbResponse;
  const url = json.data?.display_url ?? json.data?.url;
  if (!res.ok || !json.success || !url) {
    throw new ApiError(502, json.error?.message ?? "Image upload failed");
  }
  return url;
}
