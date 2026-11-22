import { Router } from "express";
import { z } from "zod";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { requireRole } from "../../middleware/requireRole.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createOrderBody } from "./orders.schema.js";
import { createOrder, listMyOrders } from "./orders.service.js";

const router = Router();
router.use(verifyJWT, loadUser);

router.post(
  "/",
  requireRole("customer"),
  asyncHandler(async (req, res) => {
    const body = createOrderBody.parse(req.body);
    res.status(201).json({ order: await createOrder(req.user!, body) });
  }),
);

router.get(
  "/my",
  requireRole("customer"),
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["pending", "accepted", "rejected", "cancelled"]).optional() })
      .parse(req.query);
    res.json({ orders: await listMyOrders(req.user!._id, status) });
  }),
);

export default router;
