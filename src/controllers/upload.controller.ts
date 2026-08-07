import path from "path";
import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../lib/errors.js";
import * as uploadService from "../services/upload.service.js";

export async function handleUpload(req: Request, res: Response) {
  if (!req.file) {
    throw new BadRequestError("No file uploaded");
  }
  const url = await uploadService.uploadToS3(req.file);
  res.json({ url });
}

// multer's own errors (file too large, fileFilter rejection) surface as a
// plain Error/MulterError, not an AppError — translate them so the client
// gets a proper 400 instead of a generic 500.
export function translateUploadError(err: unknown, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      next(new BadRequestError("Image is too large (max 10MB)"));
      return;
    }
    next(new BadRequestError(err.message));
    return;
  }
  if (err instanceof Error && err.message === "Only images are allowed") {
    next(new BadRequestError(err.message));
    return;
  }
  next(err);
}

export function serveUpload(req: Request, res: Response, next: NextFunction) {
  const filename = path.basename(req.path);
  if (uploadService.uploadExists(filename)) {
    res.sendFile(uploadService.resolveUploadPath(filename));
  } else {
    next();
  }
}
