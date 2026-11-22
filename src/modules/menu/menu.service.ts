import type { Document } from "mongodb";
import { collections } from "../../db/mongo.js";
import { escapeRegex } from "../../utils/escapeRegex.js";

export interface MenuQuery {
  q?: string;
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "price_asc" | "price_desc" | "newest";
  page?: number;
  limit?: number;
}

const SORTS: Record<NonNullable<MenuQuery["sort"]>, Document> = {
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
};

export const vendorLookupStages = (): Document[] => [
  {
    $lookup: {
      from: "users",
      localField: "vendorId",
      foreignField: "_id",
      pipeline: [
        {
          $project: {
            name: 1,
            image: 1,
            businessName: 1,
            isPremium: {
              $and: [
                { $eq: ["$subscriptionPlan", "premium"] },
                { $gt: ["$subscriptionExpiresAt", "$$NOW"] },
              ],
            },
          },
        },
      ],
      as: "vendor",
    },
  },
  { $unwind: "$vendor" },
  { $match: { "vendor.isBlocked": { $ne: true } } },
];

export function buildPublicMatch(query: MenuQuery): Document {
  const match: Document = { status: "approved" };
  if (query.category) match.category = query.category;
  if (query.location) match.location = { $regex: escapeRegex(query.location), $options: "i" };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    match.price = {
      ...(query.minPrice !== undefined && { $gte: query.minPrice }),
      ...(query.maxPrice !== undefined && { $lte: query.maxPrice }),
    };
  }
  if (query.q) {
    const rx = { $regex: escapeRegex(query.q), $options: "i" };
    match.$or = [{ itemName: rx }, { description: rx }, { location: rx }, { category: rx }];
  }
  return match;
}

export async function listMenu(query: MenuQuery) {
  const items = await collections.menuItems();
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(48, Math.max(1, query.limit ?? 12));
  const sort = SORTS[query.sort ?? "newest"];
  const [result] = await items
    .aggregate([
      { $match: buildPublicMatch(query) },
      ...vendorLookupStages(),
      {
        $facet: {
          items: [{ $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: "n" }],
        },
      },
    ])
    .toArray();
  const total: number = result?.total?.[0]?.n ?? 0;
  return { items: result?.items ?? [], total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}
