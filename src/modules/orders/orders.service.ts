import type { ObjectId } from "mongodb";
import { collections, type UserDoc } from "../../db/mongo.js";
import { ApiError } from "../../utils/ApiError.js";
import { toObjectId } from "../../utils/objectId.js";
import type { z } from "zod";
import type { createOrderBody } from "./orders.schema.js";

const startOfTodayUtc = (): Date => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export async function createOrder(customer: UserDoc, body: z.infer<typeof createOrderBody>) {
  const itemId = toObjectId(body.itemId, "menu item id");
  const deliveryDate = new Date(`${body.deliveryDate}T00:00:00.000Z`);
  if (deliveryDate < startOfTodayUtc()) throw ApiError.badRequest("Delivery date cannot be in the past");

  const [items, orders, users] = await Promise.all([
    collections.menuItems(),
    collections.orders(),
    collections.users(),
  ]);
  const item = await items.findOne({ _id: itemId });
  if (!item || item.status !== "approved") throw ApiError.notFound("This item is not available for order");
  if (String(item.vendorId) === String(customer._id)) {
    throw ApiError.forbidden("You cannot order your own menu item");
  }
  const vendor = await users.findOne({ _id: item.vendorId });
  if (!vendor || vendor.isBlocked) throw ApiError.notFound("This item is not available for order");

  const duplicate = await orders.findOne({
    customerId: customer._id,
    itemId,
    deliveryDate,
    status: { $in: ["pending", "accepted"] },
  });
  if (duplicate) throw ApiError.conflict("You already have an active order for this item on that date");

  const now = new Date();
  const doc = {
    itemId,
    vendorId: item.vendorId,
    customerId: customer._id,
    deliveryDate,
    deliveryAddress: body.deliveryAddress,
    message: body.message,
    status: "pending" as const,
    statusHistory: [{ status: "pending" as const, at: now }],
    createdAt: now,
  };
  try {
    const { insertedId } = await orders.insertOne(doc as never);
    return { _id: insertedId, ...doc };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw ApiError.conflict("You already have an active order for this item on that date");
    }
    throw err;
  }
}

export async function listMyOrders(customerId: ObjectId, status?: string) {
  const orders = await collections.orders();
  return orders
    .aggregate([
      { $match: { customerId, ...(status && { status }) } },
      { $sort: { createdAt: -1 } },
      { $lookup: { from: "menuItems", localField: "itemId", foreignField: "_id", as: "item" } },
      { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "vendorId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, image: 1, businessName: 1 } }],
          as: "vendor",
        },
      },
      { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();
}
