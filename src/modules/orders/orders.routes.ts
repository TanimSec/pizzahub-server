import { Router } from "express";
import { z } from "zod";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { requireRole } from "../../middleware/requireRole.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createOrderBody } from "./orders.schema.js";
import { toObjectId } from "../../utils/objectId.js";
import { cancelOrder, createOrder, getOrderDetail, listMyOrders } from "./orders.service.js";

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

router.patch(
  "/:id/cancel",
  requireRole("customer"),
  asyncHandler(async (req, res) => {
    const order = await cancelOrder(req.user!._id, toObjectId(req.params.id, "order id"));
    res.json({ order, message: "Order cancelled" });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ order: await getOrderDetail(req.user!, toObjectId(req.params.id, "order id")) });
  }),
);

export default router;
