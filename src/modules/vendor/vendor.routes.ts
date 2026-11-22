import { Router } from "express";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { requireRole } from "../../middleware/requireRole.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { z } from "zod";
import { vendorStats } from "./stats.service.js";
import { toObjectId } from "../../utils/objectId.js";
import { itemBody, itemPatch } from "./items.schema.js";
import { decideOrder, listVendorOrders } from "../orders/orders.service.js";
import { createItem, deleteItem, getVendorItem, listVendorItems, setAvailability, updateItem } from "./items.service.js";

const router = Router();
router.use(verifyJWT, loadUser, requireRole("vendor"));

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    res.json(await vendorStats(req.user!));
  }),
);

router.post(
  "/items",
  asyncHandler(async (req, res) => {
    const data = itemBody.parse(req.body);
    res.status(201).json({ item: await createItem(req.user!, data) });
  }),
);

router.get(
  "/items",
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["pending", "approved", "rejected", "inactive"]).optional() })
      .parse(req.query);
    res.json({ items: await listVendorItems(req.user!._id, status) });
  }),
);

router.get(
  "/items/:id",
  asyncHandler(async (req, res) => {
    res.json({ item: await getVendorItem(req.user!._id, toObjectId(req.params.id, "menu item id")) });
  }),
);

router.patch(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const patch = itemPatch.parse(req.body);
    res.json({ item: await updateItem(req.user!._id, toObjectId(req.params.id, "menu item id"), patch) });
  }),
);

router.patch(
  "/items/:id/availability",
  asyncHandler(async (req, res) => {
    const { available } = z.object({ available: z.boolean() }).strict().parse(req.body);
    res.json({
      item: await setAvailability(req.user!, toObjectId(req.params.id, "menu item id"), available),
    });
  }),
);

router.delete(
  "/items/:id",
  asyncHandler(async (req, res) => {
    await deleteItem(req.user!._id, toObjectId(req.params.id, "menu item id"));
    res.json({ message: "Menu item deleted" });
  }),
);

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["pending", "accepted", "rejected", "cancelled"]).optional() })
      .parse(req.query);
    res.json({ orders: await listVendorOrders(req.user!._id, status) });
  }),
);

router.patch(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const { action } = z.object({ action: z.enum(["accept", "reject"]) }).strict().parse(req.body);
    const order = await decideOrder(req.user!._id, toObjectId(req.params.id, "order id"), action);
    res.json({ order, message: action === "accept" ? "Order accepted" : "Order rejected" });
  }),
);

export default router;
