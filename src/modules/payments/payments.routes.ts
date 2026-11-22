import { Router } from "express";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { requireRole } from "../../middleware/requireRole.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { cancelSubscription, createCheckoutSession, getSessionStatus, listMyTransactions } from "./payments.service.js";

const router = Router();
router.use(verifyJWT, loadUser, requireRole("vendor"));

// The vendor is always taken from the verified token; no vendor id is accepted from the client.
router.post(
  "/checkout-session",
  asyncHandler(async (req, res) => {
    res.status(201).json(await createCheckoutSession(req.user!));
  }),
);

// Reports the status recorded by the verified webhook. It never activates Premium itself.
router.get(
  "/session/:sessionId",
  asyncHandler(async (req, res) => {
    res.json(await getSessionStatus(req.user!, String(req.params.sessionId)));
  }),
);

router.get(
  "/my-transactions",
  asyncHandler(async (req, res) => {
    res.json({ transactions: await listMyTransactions(req.user!) });
  }),
);

router.post(
  "/cancel-subscription",
  asyncHandler(async (req, res) => {
    res.json(await cancelSubscription(req.user!));
  }),
);

export default router;
