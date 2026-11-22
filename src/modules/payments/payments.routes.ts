import { Router } from "express";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { requireRole } from "../../middleware/requireRole.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createCheckoutSession } from "./payments.service.js";

const router = Router();
router.use(verifyJWT, loadUser, requireRole("vendor"));

// The vendor is always taken from the verified token; no vendor id is accepted from the client.
router.post(
  "/checkout-session",
  asyncHandler(async (req, res) => {
    res.status(201).json(await createCheckoutSession(req.user!));
  }),
);

export default router;
