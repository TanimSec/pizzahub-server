import type Stripe from "stripe";
import { collections } from "../../db/mongo.js";
import { stripe } from "../payments/stripe.js";
import { downgradeVendor } from "../payments/downgrade.js";
import { customerId, invoiceSubscriptionId, periodEnd, vendorIdFrom } from "./helpers.js";

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

async function recordInvoiceTx(invoice: Stripe.Invoice, status: "paid" | "failed"): Promise<void> {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId || !invoice.id) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const vendorId = vendorIdFrom(sub.metadata);
  if (!vendorId) return;

  const [users, tx] = await Promise.all([collections.users(), collections.transactions()]);
  try {
    await tx.insertOne({
      vendorId,
      plan: "premium",
      amount: (status === "paid" ? invoice.amount_paid : invoice.amount_due) / 100,
      currency: invoice.currency,
      stripeSubscriptionId: subscriptionId,
      stripeInvoiceId: invoice.id,
      status,
      createdAt: new Date(),
    } as never);
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    return;
  }
  if (status === "paid") {
    const expiresAt = periodEnd(sub);
    if (expiresAt) {
      await users.updateOne({ _id: vendorId }, { $set: { subscriptionPlan: "premium", subscriptionExpiresAt: expiresAt } });
    }
  }
}

// First invoice is already recorded by checkout.session.completed; only renewals are handled here.
export async function onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (invoice.billing_reason !== "subscription_cycle") return;
  await recordInvoiceTx(invoice, "paid");
}

export async function onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  await recordInvoiceTx(invoice, "failed");
}

export async function onSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const vendorId = vendorIdFrom(sub.metadata);
  const expiresAt = periodEnd(sub);
  if (!vendorId || !expiresAt) return;
  if (sub.status === "active" || sub.status === "trialing") {
    const users = await collections.users();
    await users.updateOne({ _id: vendorId }, { $set: { subscriptionPlan: "premium", subscriptionExpiresAt: expiresAt } });
  }
}

export async function onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const vendorId = vendorIdFrom(sub.metadata);
  if (!vendorId) return;
  await downgradeVendor(vendorId);
}

export async function onCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  const tx = await collections.transactions();
  await tx.updateOne({ stripeSessionId: session.id, status: "pending" }, { $set: { status: "canceled" } });
}
