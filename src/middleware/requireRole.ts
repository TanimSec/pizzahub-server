import type { RequestHandler } from "express";
import type { Role } from "../db/mongo.js";
import { ApiError } from "../utils/ApiError.js";

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden("Insufficient permissions"));
    next();
  };

