import type { ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";
import { FREE_ITEM_LIMIT } from "../../utils/premium.js";

export async function downgradeVendor(vendorId: ObjectId): Promise<void> {
  const [users, items] = await Promise.all([collections.users(), collections.menuItems()]);
  await users.updateOne({ _id: vendorId }, { $set: { subscriptionPlan: "free", subscriptionExpiresAt: null } });
  const keep = await items
    .find({ vendorId, status: { $in: ["approved", "pending"] } }, { projection: { _id: 1 } })
    .sort({ createdAt: -1 })
    .limit(FREE_ITEM_LIMIT)
    .toArray();
  await items.updateMany(
    { vendorId, status: { $in: ["approved", "pending"] }, _id: { $nin: keep.map((k) => k._id) } },
    { $set: { status: "inactive", updatedAt: new Date() } },
  );
}
