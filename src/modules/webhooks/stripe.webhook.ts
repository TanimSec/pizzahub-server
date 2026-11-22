import type { RequestHandler } from "express";
import type Stripe from "stripe";
import { env } from "../../config/env.js";
import { stripe } from "../payments/stripe.js";
import { onCheckoutCompleted } from "./handlers.js";

export const stripeWebhook: RequestHandler = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ message: "Missing Stripe signature" });
    return;
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    res.status(400).json({ message: "Invalid webhook signature" });
    return;
  }
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error(`Webhook ${event.type} failed`, err);
    res.status(500).json({ message: "Webhook handler failed" });
  }
};
