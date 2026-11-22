import type { RequestHandler } from "express";
import { ensureIndexes } from "../db/indexes.js";

let pending: Promise<void> | null = null;

// Serverless-safe: create indexes once per instance; never block requests if it fails.
export const ensureIndexesOnce: RequestHandler = (_req, _res, next) => {
  pending ??= ensureIndexes().catch((err) => {
    console.error("Index creation failed", err);
    pending = null;
  });
  pending.finally(() => next());
};
