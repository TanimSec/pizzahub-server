import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../db/mongo.js";
import { ApiError } from "../utils/ApiError.js";
import { isPremium } from "../utils/premium.js";
import { downgradeVendor } from "../modules/payments/downgrade.js";

export const loadUser: RequestHandler = async (req, _res, next) => {
  try {
    const sub = req.authUserId;
    if (!sub || !ObjectId.isValid(sub)) throw ApiError.unauthorized("Invalid token subject");
    const users = await collections.users();
    const user = await users.findOne({ _id: new ObjectId(sub) });
    if (!user) throw ApiError.unauthorized("User not found");
    if (user.isBlocked) throw ApiError.forbidden("Your account is blocked");
    if (user.subscriptionPlan === "premium" && !isPremium(user)) {
      await downgradeVendor(user._id);
      user.subscriptionPlan = "free";
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
