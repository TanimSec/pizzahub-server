import { Router } from "express";
import { z } from "zod";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { collections, type UserDoc } from "../../db/mongo.js";
import { isPremium } from "../../utils/premium.js";

const router = Router();
router.use(verifyJWT, loadUser);

export const publicUser = (u: UserDoc) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  image: u.image ?? null,
  role: u.role,
  businessName: u.businessName ?? null,
  isBlocked: !!u.isBlocked,
  subscriptionPlan: isPremium(u) ? "premium" : "free",
  subscriptionExpiresAt: u.subscriptionExpiresAt ?? null,
});

const profilePatch = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(60),
    image: z.string().url().max(500).nullable(),
    businessName: z.string().trim().min(2).max(80),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user!) });
  }),
);

router.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const patch = profilePatch.parse(req.body);
    if (patch.businessName !== undefined && req.user!.role !== "vendor") {
      throw ApiError.badRequest("Only vendors can set a business name");
    }
    const users = await collections.users();
    const updated = await users.findOneAndUpdate(
      { _id: req.user!._id },
      { $set: { ...patch, updatedAt: new Date() } as never },
      { returnDocument: "after" },
    );
    if (!updated) throw ApiError.notFound("User not found");
    res.json({ user: publicUser(updated), message: "Profile updated" });
  }),
);

export default router;
