import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { listMenu } from "./menu.service.js";
import { CATEGORIES } from "../../constants.js";

const router = Router();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  location: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(["price_asc", "price_desc", "newest"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuery.parse(req.query);
    res.json(await listMenu(query));
  }),
);

export default router;
