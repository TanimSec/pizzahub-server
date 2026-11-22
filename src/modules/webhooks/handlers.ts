import type Stripe from "stripe";
import { collections } from "../../db/mongo.js";
import { stripe } from "../payments/stripe.js";
import { customerId, periodEnd, vendorIdFrom } from "./helpers.js";

export async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "subscription" || session.payment_status !== "paid") return;
  const vendorId = vendorIdFrom(session.metadata, session.client_reference_id);
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!vendorId || !subscriptionId) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const expiresAt = periodEnd(sub);
  if (!expiresAt) throw new Error("Subscription has no period end");

  const [users, tx] = await Promise.all([collections.users(), collections.transactions()]);
  const vendor = await users.findOne({ _id: vendorId }, { projection: { _id: 1 } });
  if (!vendor) return;

  await tx.updateOne(
    { stripeSessionId: session.id },
    {
      $set: {
        vendorId,
        plan: "premium",
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency ?? "usd",
        stripeSubscriptionId: subscriptionId,
        status: "paid",
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  await users.updateOne(
    { _id: vendorId },
    {
      $set: {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: expiresAt,
        ...(customerId(session.customer) && { stripeCustomerId: customerId(session.customer) }),
      },
    },
  );
}
