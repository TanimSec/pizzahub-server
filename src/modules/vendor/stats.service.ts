import type { ObjectId } from "mongodb";
import { collections, type UserDoc } from "../../db/mongo.js";
import { isPremium } from "../../utils/premium.js";
import { fillMonths, monthStart, monthlyGroupStage } from "../../utils/stats.js";

export async function vendorStats(vendor: UserDoc) {
  const vendorId: ObjectId = vendor._id;
  const [items, orders] = await Promise.all([collections.menuItems(), collections.orders()]);
  const [totalItems, activeItems, byStatus, orderRows, monthly] = await Promise.all([
    items.countDocuments({ vendorId }),
    items.countDocuments({ vendorId, status: "approved" }),
    items.aggregate([{ $match: { vendorId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
    orders.aggregate([{ $match: { vendorId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
    orders
      .aggregate([
        { $match: { vendorId, createdAt: { $gte: monthStart(5) } } },
        monthlyGroupStage({ count: { $sum: 1 } }),
      ])
      .toArray(),
  ]);
  const orderCount = (s: string) => (orderRows.find((r) => r._id === s)?.count as number) ?? 0;
  return {
    totalItems,
    activeItems,
    pendingOrders: orderCount("pending"),
    acceptedOrders: orderCount("accepted"),
    rejectedOrders: orderCount("rejected"),
    subscriptionPlan: isPremium(vendor) ? "premium" : "free",
    subscriptionExpiresAt: vendor.subscriptionExpiresAt ?? null,
    charts: {
      itemsByStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
      ordersByStatus: orderRows.map((r) => ({ status: r._id, count: r.count })),
      ordersPerMonth: fillMonths(monthly, ["count"]),
    },
  };
}
