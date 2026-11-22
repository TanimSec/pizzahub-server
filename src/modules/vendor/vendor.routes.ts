import { Router } from "express";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { requireRole } from "../../middleware/requireRole.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { itemBody } from "./items.schema.js";
import { createItem } from "./items.service.js";

const router = Router();
router.use(verifyJWT, loadUser, requireRole("vendor"));

router.post(
  "/items",
  asyncHandler(async (req, res) => {
    const data = itemBody.parse(req.body);
    res.status(201).json({ item: await createItem(req.user!, data) });
  }),
);

export default router;
