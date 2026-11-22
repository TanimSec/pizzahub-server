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

export async function listVendorItems(vendorId: ObjectId, status?: string) {
  const items = await collections.menuItems();
  return items
    .find({ vendorId, ...(status && { status: status as never }) })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getVendorItem(vendorId: ObjectId, id: ObjectId) {
  const items = await collections.menuItems();
  const item = await items.findOne({ _id: id, vendorId });
  if (!item) throw ApiError.notFound("Menu item not found");
  return item;
}

export async function updateItem(
  vendorId: ObjectId,
  id: ObjectId,
  patch: Partial<z.infer<typeof itemBody>>,
) {
  const items = await collections.menuItems();
  const current = await getVendorItem(vendorId, id);
  const resubmit = current.status === "approved" || current.status === "rejected";
  const $set = { ...patch, updatedAt: new Date(), ...(resubmit && { status: "pending" as const }) };
  const updated = await items.findOneAndUpdate({ _id: id, vendorId }, { $set }, { returnDocument: "after" });
  if (!updated) throw ApiError.notFound("Menu item not found");
  return updated;
}

export async function deleteItem(vendorId: ObjectId, id: ObjectId) {
  const [items, orders] = await Promise.all([collections.menuItems(), collections.orders()]);
  await getVendorItem(vendorId, id);
  const open = await orders.countDocuments({ itemId: id, status: { $in: ["pending", "accepted"] } });
  if (open > 0) throw ApiError.conflict("This item has active orders. Resolve them before deleting.");
  await items.deleteOne({ _id: id, vendorId });
}

export async function setAvailability(vendor: UserDoc, id: ObjectId, available: boolean) {
  const items = await collections.menuItems();
  const item = await getVendorItem(vendor._id, id);
  if (available) {
    if (item.status === "approved") return item;
    if (item.status !== "inactive") {
      throw ApiError.conflict("Only previously approved items can be made available again");
    }
    if (item.deactivatedBy === "admin") {
      throw ApiError.forbidden("This item was deactivated by an admin and cannot be re-enabled");
    }
    await assertCanActivate(vendor, id);
    const updated = await items.findOneAndUpdate(
      { _id: id, vendorId: vendor._id, status: "inactive" },
      { $set: { status: "approved", deactivatedBy: null, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!updated) throw ApiError.conflict("Item state changed, please refresh");
    return updated;
  }
  if (item.status === "inactive") return item;
  if (item.status !== "approved") {
    throw ApiError.conflict("Only approved items can be made unavailable");
  }
  const updated = await items.findOneAndUpdate(
    { _id: id, vendorId: vendor._id, status: "approved" },
    { $set: { status: "inactive", deactivatedBy: "vendor", updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) throw ApiError.conflict("Item state changed, please refresh");
  return updated;
}
