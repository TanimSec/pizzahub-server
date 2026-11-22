import { Router } from "express";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { requireRole } from "../../middleware/requireRole.js";
import usersRoutes from "./adminUsers.routes.js";
import itemsRoutes from "./adminItems.routes.js";
import statsRoutes from "./adminStats.routes.js";
import transactionsRoutes from "./adminTransactions.routes.js";

const router = Router();
router.use(verifyJWT, loadUser, requireRole("admin"));
router.use("/users", usersRoutes);
router.use("/items", itemsRoutes);
router.use("/stats", statsRoutes);
router.use("/transactions", transactionsRoutes);

export default router;
