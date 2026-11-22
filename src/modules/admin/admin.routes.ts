import { Router } from "express";
import { z } from "zod";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { requireRole } from "../../middleware/requireRole.js";
import usersRoutes from "./adminUsers.routes.js";

const router = Router();
router.use(verifyJWT, loadUser, requireRole("admin"));
router.use("/users", usersRoutes);

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export default router;
