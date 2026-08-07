import { Router, type IRouter } from "express";
import * as userController from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

router.get("/users/me/bookmarks", requireAuth, userController.getBookmarks);
router.get("/users/me/posts", requireAuth, userController.getMyPosts);
router.patch("/users/me", requireAuth, userController.updateProfile);
router.get("/users/:username", userController.getPublicProfile);

export default router;
