import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { toObjectId } from "../../utils/objectId.js";
import { escapeRegex } from "../../utils/escapeRegex.js";
import { collections, getDb } from "../../db/mongo.js";
import { publicUser } from "../users/users.routes.js";

const router = Router();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["vendor", "customer", "admin"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, role, page, limit } = listQuery.parse(req.query);
    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const users = await collections.users();
    const [rows, total] = await Promise.all([
      users
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      users.countDocuments(filter),
    ]);
    res.json({
      users: rows.map((u) => ({ ...publicUser(u), createdAt: (u as { createdAt?: Date }).createdAt ?? null })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = toObjectId(req.params.id, "user id");
    const [users, items, orders] = await Promise.all([
      collections.users(),
      collections.menuItems(),
      collections.orders(),
    ]);
    const user = await users.findOne({ _id: id });
    if (!user) throw ApiError.notFound("User not found");
    const [itemCount, orderCount] = await Promise.all([
      items.countDocuments({ vendorId: id }),
      orders.countDocuments({ $or: [{ customerId: id }, { vendorId: id }] }),
    ]);
    res.json({
      user: { ...publicUser(user), createdAt: (user as { createdAt?: Date }).createdAt ?? null },
      itemCount,
      orderCount,
    });
  }),
);

router.patch(
  "/:id/block",
  asyncHandler(async (req, res) => {
    const { isBlocked } = z.object({ isBlocked: z.boolean() }).strict().parse(req.body);
    const id = toObjectId(req.params.id, "user id");
    if (String(id) === String(req.user!._id)) throw ApiError.badRequest("You cannot block yourself");
    const users = await collections.users();
    const target = await users.findOne({ _id: id });
    if (!target) throw ApiError.notFound("User not found");
    if (target.role === "admin") throw ApiError.forbidden("Admin accounts cannot be blocked");
    await users.updateOne({ _id: id }, { $set: { isBlocked, updatedAt: new Date() } as never });
    if (isBlocked) {
      const db = await getDb();
      await db.collection("session").deleteMany({ userId: { $in: [id, String(id)] } as never });
    }
    res.json({ message: isBlocked ? "User blocked" : "User unblocked" });
  }),
);

export default router;
