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
