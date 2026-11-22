import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import menuRoutes from "./modules/menu/menu.routes.js";
import uploadRoutes from "./modules/uploads/uploads.routes.js";
import vendorRoutes from "./modules/vendor/vendor.routes.js";
import orderRoutes from "./modules/orders/orders.routes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => res.json({ name: "PizzaHub API", ok: true }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/menu", menuRoutes);

app.use("/api/uploads", uploadRoutes);

app.use("/api/vendor", vendorRoutes);

app.use("/api/orders", orderRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
