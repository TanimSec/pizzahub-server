import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import menuRoutes from "./modules/menu/menu.routes.js";
import uploadRoutes from "./modules/uploads/uploads.routes.js";
import vendorRoutes from "./modules/vendor/vendor.routes.js";
import orderRoutes from "./modules/orders/orders.routes.js";
import customerRoutes from "./modules/customer/customer.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import paymentRoutes from "./modules/payments/payments.routes.js";
import { stripeWebhook } from "./modules/webhooks/stripe.webhook.js";
import { apiLimiter, writeLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
// Stripe needs the raw body for signature verification, so it is mounted before express.json().
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhook);
app.use(express.json({ limit: "1mb" }));

app.use("/api", apiLimiter, writeLimiter);

app.get("/", (_req, res) => res.json({ name: "PizzaHub API", ok: true }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/menu", menuRoutes);

app.use("/api/uploads", uploadRoutes);

app.use("/api/vendor", vendorRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/customer", customerRoutes);

app.use("/api/users", userRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/payments", paymentRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
