import { Router } from "express";
import { z } from "zod";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { toObjectId } from "../../utils/objectId.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { categoryCounts, distinctLocations, featuredMenu, getMenuItem, listMenu } from "./menu.service.js";
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

router.get(
  "/featured",
  asyncHandler(async (_req, res) => {
    res.json({ items: await featuredMenu(8) });
  }),
);

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    res.json({ categories: await categoryCounts() });
  }),
);

router.get(
  "/locations",
  asyncHandler(async (_req, res) => {
    res.json({ locations: await distinctLocations() });
  }),
);

router.get(
  "/:id",
  verifyJWT,
  loadUser,
  asyncHandler(async (req, res) => {
    res.json({ item: await getMenuItem(toObjectId(req.params.id, "menu item id"), req.user!) });
  }),
);

export default router;
