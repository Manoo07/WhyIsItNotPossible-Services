import { Router, type IRouter } from "express";
import * as followController from "../controllers/follow.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

router.post("/authors/:authorId/follow", requireAuth, followController.follow);
router.delete("/authors/:authorId/follow", requireAuth, followController.unfollow);
router.get("/authors/:authorId/follow-status", followController.getFollowStatus);
router.patch("/authors/:authorId/notification-preference", requireAuth, followController.updateNotificationPreference);

router.get("/me/followed-authors", requireAuth, followController.listFollowedAuthors);
router.get("/me/notification-settings", requireAuth, followController.getNotificationSettings);
router.patch("/me/notification-settings", requireAuth, followController.updateNotificationSettings);

export default router;
