import { Router } from "express";
import multer from "multer";
import { verifyJWT } from "../../middleware/verifyJWT.js";
import { loadUser } from "../../middleware/loadUser.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { uploadToImgbb } from "./imgbb.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(ApiError.badRequest("Only JPG, PNG or WEBP images are allowed"));
    cb(null, true);
  },
});

/**
 * "imgbb" and "cloudinary" use that host only. "auto" tries ImgBB first and falls back to Cloudinary
 * when ImgBB refuses or is unreachable, so uploads keep working even if ImgBB blocks the API key.
 */
async function uploadImage(buffer: Buffer, filename: string, mime: string): Promise<string> {
  if (env.IMAGE_PROVIDER === "imgbb") return uploadToImgbb(buffer, filename, mime);
  if (env.IMAGE_PROVIDER === "cloudinary") return uploadToCloudinary(buffer, filename, mime);
  if (env.IMGBB_API_KEY) {
    try {
      return await uploadToImgbb(buffer, filename, mime);
    } catch (err) {
      console.warn("ImgBB upload failed, falling back to Cloudinary:", (err as Error).message);
    }
  }
  return uploadToCloudinary(buffer, filename, mime);
}

const router = Router();

router.post(
  "/image",
  verifyJWT,
  loadUser,
  (req, res, next) => {
    upload.single("image")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        return next(ApiError.badRequest(err.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller" : err.message));
      }
      next(err);
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("Image file is required");
    const url = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.status(201).json({ url });
  }),
);

export default router;
