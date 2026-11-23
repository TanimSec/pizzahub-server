import type { UserDoc } from "../../db/mongo.js";
import { collections } from "../../db/mongo.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { isPremium } from "../../utils/premium.js";
import { stripe } from "./stripe.js";

export async function createCheckoutSession(vendor: UserDoc) {
  if (isPremium(vendor)) throw ApiError.conflict("You already have an active Premium subscription");
  const vendorId = String(vendor._id);

  let price;
  try {
    price = await stripe.prices.retrieve(env.STRIPE_PREMIUM_PRICE_ID);
  } catch {
    throw new ApiError(502, "Payment provider is unavailable. Please try again.");
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Show the plan price exactly as configured (USD) instead of converting it to the buyer's currency.
      adaptive_pricing: { enabled: false },
      line_items: [{ price: env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
      client_reference_id: vendorId,
      metadata: { vendorId },
      subscription_data: { metadata: { vendorId } },
      ...(vendor.stripeCustomerId ? { customer: vendor.stripeCustomerId } : { customer_email: vendor.email }),
      success_url: `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.CLIENT_URL}/payment/cancel`,
    });
  } catch {
    throw new ApiError(502, "Could not start checkout. Please try again.");
  }
  if (!session.url) throw new ApiError(502, "Could not start checkout. Please try again.");

  const tx = await collections.transactions();
  await tx.insertOne({
    vendorId: vendor._id,
    plan: "premium",
    amount: (price.unit_amount ?? 0) / 100,
    currency: price.currency,
    stripeSessionId: session.id,
    status: "pending",
    createdAt: new Date(),
  } as never);

  return { url: session.url, sessionId: session.id };
}

export async function getSessionStatus(vendor: UserDoc, sessionId: string) {
  const tx = await collections.transactions();
  const row = await tx.findOne({ stripeSessionId: sessionId, vendorId: vendor._id });
  if (!row) throw ApiError.notFound("Payment session not found");
  return { status: row.status, plan: row.plan, amount: row.amount, currency: row.currency };
}

export async function listMyTransactions(vendor: UserDoc) {
  const tx = await collections.transactions();
  return tx.find({ vendorId: vendor._id }).sort({ createdAt: -1 }).limit(100).toArray();
}

export async function cancelSubscription(vendor: UserDoc) {
  const tx = await collections.transactions();
  const latest = await tx.findOne(
    { vendorId: vendor._id, status: "paid", stripeSubscriptionId: { $exists: true } },
    { sort: { createdAt: -1 } },
  );
  if (!latest?.stripeSubscriptionId || !isPremium(vendor)) {
    throw ApiError.badRequest("No active subscription to cancel");
  }
  try {
    await stripe.subscriptions.update(latest.stripeSubscriptionId, { cancel_at_period_end: true });
  } catch {
    throw new ApiError(502, "Could not cancel the subscription. Please try again.");
  }
  return { message: "Subscription will end at the close of the current billing period" };
}
