import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { toObjectId } from "../../utils/objectId.js";
import { escapeRegex } from "../../utils/escapeRegex.js";
import { collections } from "../../db/mongo.js";
import { CATEGORIES } from "../../constants.js";

const router = Router();
const STATUSES = ["pending", "approved", "rejected", "inactive"] as const;

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, status, category, page, limit } = listQuery.parse(req.query);
    const match: Record<string, unknown> = {};
    if (status) match.status = status;
    if (category) match.category = category;
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      match.$or = [{ itemName: rx }, { location: rx }, { description: rx }];
    }
    const items = await collections.menuItems();
    const [result] = await items
      .aggregate([
        { $match: match },
        {
          $lookup: {
            from: "users",
            localField: "vendorId",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1, email: 1, businessName: 1, image: 1 } }],
            as: "vendor",
          },
        },
        { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
        {
          $facet: {
            items: [{ $sort: { createdAt: -1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }],
            total: [{ $count: "n" }],
          },
        },
      ])
      .toArray();
    const total: number = result?.total?.[0]?.n ?? 0;
    res.json({ items: result?.items ?? [], total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);

router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(STATUSES) }).strict().parse(req.body);
    const items = await collections.menuItems();
    const updated = await items.findOneAndUpdate(
      { _id: toObjectId(req.params.id, "menu item id") },
      {
        $set: {
          status,
          deactivatedBy: status === "inactive" ? "admin" : null,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) throw ApiError.notFound("Menu item not found");
    res.json({ item: updated, message: `Item marked ${status}` });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = toObjectId(req.params.id, "menu item id");
    const [items, orders] = await Promise.all([collections.menuItems(), collections.orders()]);
    const { deletedCount } = await items.deleteOne({ _id: id });
    if (!deletedCount) throw ApiError.notFound("Menu item not found");
    await orders.updateMany(
      { itemId: id, status: "pending" },
      { $set: { status: "rejected" }, $push: { statusHistory: { status: "rejected", at: new Date() } } },
    );
    res.json({ message: "Menu item deleted" });
  }),
);

export default router;
