import type { RequestHandler } from "express";
import { ensureIndexes } from "../db/indexes.js";

let started = false;

// Serverless-safe: kick off index creation once per instance without ever blocking a request.
export const ensureIndexesOnce: RequestHandler = (_req, _res, next) => {
  if (!started) {
    started = true;
    ensureIndexes().catch((err) => {
      started = false;
      console.error("Index creation failed", err);
    });
  }
  next();
};
