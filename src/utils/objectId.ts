import { ObjectId } from "mongodb";
import { ApiError } from "./ApiError.js";

export function toObjectId(value: unknown, label = "id"): ObjectId {
  if (typeof value !== "string" || !ObjectId.isValid(value) || String(new ObjectId(value)) !== value) {
    throw ApiError.notFound(`Invalid ${label}`);
  }
  return new ObjectId(value);
}
