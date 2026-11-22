import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { collections } from "../../db/mongo.js";
import { fillMonths, monthStart, monthlyGroupStage } from "../../utils/stats.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [users, items, tx] = await Promise.all([
      collections.users(),
      collections.menuItems(),
      collections.transactions(),
    ]);
    const [roleRows, totalItems, pendingItems, totalTransactions, byCategory, byStatus, revenue] =
      await Promise.all([
        users.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]).toArray(),
        items.countDocuments(),
        items.countDocuments({ status: "pending" }),
        tx.countDocuments(),
        items.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]).toArray(),
        items.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
        tx
          .aggregate([
            { $match: { status: "paid", createdAt: { $gte: monthStart(5) } } },
            monthlyGroupStage({ revenue: { $sum: "$amount" }, count: { $sum: 1 } }),
          ])
          .toArray(),
      ]);
    const role = (r: string) => (roleRows.find((x) => x._id === r)?.count as number) ?? 0;
    res.json({
      totalUsers: roleRows.reduce((a, r) => a + (r.count as number), 0),
      totalVendors: role("vendor"),
      totalCustomers: role("customer"),
      totalMenuItems: totalItems,
      pendingMenuItems: pendingItems,
      totalTransactions,
      charts: {
        usersByRole: roleRows.map((r) => ({ role: r._id, count: r.count })),
        itemsByCategory: byCategory.map((r) => ({ category: r._id, count: r.count })),
        itemsByStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
        revenuePerMonth: fillMonths(revenue, ["revenue", "count"]),
      },
    });
  }),
);

export default router;
