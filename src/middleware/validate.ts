import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/ApiError.js";

type Source = "body" | "query" | "params";

export const validate =
  (schema: ZodType, source: Source = "body"): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(ApiError.badRequest("Validation failed", result.error.flatten().fieldErrors));
    }
    if (source === "query") {
      res_locals(req).validatedQuery = result.data;
    } else {
      (req as unknown as Record<string, unknown>)[source] = result.data;
    }
    next();
  };

function res_locals(req: Parameters<RequestHandler>[0]) {
  return req as unknown as { validatedQuery?: unknown };
}
