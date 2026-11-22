import type { UserDoc } from "../db/mongo.js";

export const FREE_ITEM_LIMIT = 3;

export function isPremium(user: Pick<UserDoc, "subscriptionPlan" | "subscriptionExpiresAt">): boolean {
  return (
    user.subscriptionPlan === "premium" &&
    !!user.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt).getTime() > Date.now()
  );
}
