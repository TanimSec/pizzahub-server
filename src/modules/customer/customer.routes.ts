import { Router } from "express";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { requireRole } from "../../middleware/requireRole.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { collections } from "../../db/mongo.js";
import { fillMonths, monthStart, monthlyGroupStage } from "../../utils/stats.js";

const router = Router();
router.use(verifyJWT, loadUser, requireRole("customer"));

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const customerId = req.user!._id;
    const orders = await collections.orders();
    const [rows, monthly] = await Promise.all([
      orders.aggregate([{ $match: { customerId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
      orders
        .aggregate([{ $match: { customerId, createdAt: { $gte: monthStart(5) } } }, monthlyGroupStage()])
        .toArray(),
    ]);
    const n = (s: string) => (rows.find((r) => r._id === s)?.count as number) ?? 0;
    res.json({
      total: rows.reduce((a, r) => a + (r.count as number), 0),
      pending: n("pending"),
      accepted: n("accepted"),
      rejected: n("rejected"),
      cancelled: n("cancelled"),
      charts: {
        ordersByStatus: rows.map((r) => ({ status: r._id, count: r.count })),
        ordersPerMonth: fillMonths(monthly, ["count"]),
      },
    });
  }),
);

export default router;
