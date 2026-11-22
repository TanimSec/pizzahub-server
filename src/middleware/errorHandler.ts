import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ message: err.message, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ message: "Validation failed", details: err.flatten().fieldErrors });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ message: "Invalid JSON body" });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
};
