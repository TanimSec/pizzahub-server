import { z } from "zod";
import { CATEGORIES } from "../../constants.js";

const imageUrl = z
  .string()
  .url()
  .refine((u) => {
    try {
      const url = new URL(u);
      const host = url.hostname;
      const trusted = host === "ibb.co" || host.endsWith(".ibb.co") || host === "res.cloudinary.com";
      return url.protocol === "https:" && trusted;
    } catch {
      return false;
    }
  }, "Image must be uploaded through the platform image host");

export const itemBody = z
  .object({
    itemName: z.string().trim().min(2, "Name is too short").max(80),
    category: z.enum(CATEGORIES),
    description: z.string().trim().min(10, "Description must be at least 10 characters").max(1000),
    price: z.coerce.number().positive("Price must be greater than 0").max(1000),
    location: z.string().trim().min(2).max(80),
    images: z.array(imageUrl).min(1, "At least one image is required").max(5),
  })
  .strict();

export const itemPatch = itemBody.partial().strict();
