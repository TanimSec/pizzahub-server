import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { collections } from "../../db/mongo.js";

const router = Router();

const listQuery = z.object({
  status: z.enum(["pending", "paid", "failed", "canceled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Read-only by design: no create/update/delete routes exist for transactions.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, page, limit } = listQuery.parse(req.query);
    const tx = await collections.transactions();
    const match = status ? { status } : {};
    const [result] = await tx
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
            transactions: [{ $sort: { createdAt: -1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }],
            total: [{ $count: "n" }],
          },
        },
      ])
      .toArray();
    const total: number = result?.total?.[0]?.n ?? 0;
    res.json({
      transactions: result?.transactions ?? [],
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

export default router;
