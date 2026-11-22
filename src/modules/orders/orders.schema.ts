import { z } from "zod";

export const createOrderBody = z
  .object({
    itemId: z.string().min(1),
    deliveryDate: z.iso.date("Delivery date must be YYYY-MM-DD"),
    deliveryAddress: z.string().trim().min(5, "Address is too short").max(300),
    message: z.string().trim().max(500).optional().default(""),
  })
  .strict();
