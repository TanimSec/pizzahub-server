import type { ObjectId } from "mongodb";
import { collections, type UserDoc } from "../../db/mongo.js";
import { ApiError } from "../../utils/ApiError.js";
import { FREE_ITEM_LIMIT, isPremium } from "../../utils/premium.js";
import type { z } from "zod";
import type { itemBody } from "./items.schema.js";

export async function assertCanActivate(vendor: UserDoc, excludeId?: ObjectId): Promise<void> {
  if (isPremium(vendor)) return;
  const items = await collections.menuItems();
  const active = await items.countDocuments({
    vendorId: vendor._id,
    status: { $in: ["pending", "approved"] },
    ...(excludeId && { _id: { $ne: excludeId } }),
  });
  if (active >= FREE_ITEM_LIMIT) {
    throw ApiError.forbidden(
      `Free plan allows ${FREE_ITEM_LIMIT} active menu items. Upgrade to Premium to add more.`,
    );
  }
}

export async function createItem(vendor: UserDoc, data: z.infer<typeof itemBody>) {
  await assertCanActivate(vendor);
  const items = await collections.menuItems();
  const now = new Date();
  const doc = { ...data, vendorId: vendor._id, status: "pending" as const, createdAt: now, updatedAt: now };
  const { insertedId } = await items.insertOne(doc as never);
  return { _id: insertedId, ...doc };
}
