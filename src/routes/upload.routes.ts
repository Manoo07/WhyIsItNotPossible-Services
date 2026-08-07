import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadMiddleware } from "../services/upload.service.js";
import * as uploadController from "../controllers/upload.controller.js";

const router: IRouter = Router();

router.post(
  "/upload",
  requireAuth,
  uploadMiddleware.single("file"),
  uploadController.translateUploadError,
  uploadController.handleUpload,
);
router.use("/uploads", uploadController.serveUpload);

export default router;
