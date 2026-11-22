import type { UserDoc } from "../db/mongo.js";

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
      user?: UserDoc;
    }
  }
}
export {};
