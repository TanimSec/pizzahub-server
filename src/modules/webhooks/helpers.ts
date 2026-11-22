import type Stripe from "stripe";
import { ObjectId } from "mongodb";

export function periodEnd(sub: Stripe.Subscription): Date | null {
  const fromItem = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const seconds = fromItem?.current_period_end ?? legacy;
  return seconds ? new Date(seconds * 1000) : null;
}

export function vendorIdFrom(...sources: (Record<string, string> | null | undefined | string)[]): ObjectId | null {
  for (const s of sources) {
    const v = typeof s === "string" ? s : s?.vendorId;
    if (v && ObjectId.isValid(v)) return new ObjectId(v);
  }
  return null;
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = (invoice as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } })
    .parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

export const customerId = (c: string | { id: string } | null | undefined): string | undefined =>
  !c ? undefined : typeof c === "string" ? c : c.id;
