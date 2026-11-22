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
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuery.parse(req.query);
    res.json({ items: await listMenu(query) });
  }),
);

export default router;
