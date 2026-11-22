import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests, please slow down." },
});

export const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.method === "GET",
  message: { message: "Too many requests, please slow down." },
});
