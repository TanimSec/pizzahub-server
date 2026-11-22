import type { Document } from "mongodb";
import { collections } from "../../db/mongo.js";
import { escapeRegex } from "../../utils/escapeRegex.js";

export interface MenuQuery {
  q?: string;
  category?: string;
  location?: string;
}

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
  if (query.q) {
    const rx = { $regex: escapeRegex(query.q), $options: "i" };
    match.$or = [{ itemName: rx }, { description: rx }, { location: rx }, { category: rx }];
  }
  return match;
}

export async function listMenu(query: MenuQuery) {
  const items = await collections.menuItems();
  return items
    .aggregate([{ $match: buildPublicMatch(query) }, { $sort: { createdAt: -1 } }, ...vendorLookupStages()])
    .toArray();
}
