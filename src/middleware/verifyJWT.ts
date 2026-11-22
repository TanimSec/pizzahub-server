import { createRemoteJWKSet, jwtVerify } from "jose";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const jwks = createRemoteJWKSet(new URL(env.AUTH_JWKS_URL), {
  cooldownDuration: 10_000,
  cacheMaxAge: 10 * 60_000,
});

export const verifyJWT: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing bearer token"));
  }
  const token = header.slice(7).trim();
  if (!token) return next(ApiError.unauthorized("Missing bearer token"));
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      clockTolerance: 5,
    });
    if (!payload.sub) return next(ApiError.unauthorized("Invalid token"));
    req.authUserId = payload.sub;
    next();
  } catch (err) {
    const code = (err as { code?: string }).code;
    next(ApiError.unauthorized(code === "ERR_JWT_EXPIRED" ? "Token expired" : "Invalid token"));
  }
};
