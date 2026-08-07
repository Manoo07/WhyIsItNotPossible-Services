import { Router, type IRouter } from "express";
import * as postController from "../controllers/post.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

router.get("/posts", postController.list);
router.get("/posts/featured", postController.featured);
router.get("/posts/trending", postController.trending);
router.get("/posts/stats", postController.stats);
router.get("/posts/:id", postController.getById);
router.get("/posts/slug/:slug", postController.getBySlug);
router.post("/posts", requireRole("owner", "author"), postController.create);
router.patch("/posts/:id", requireAuth, postController.update);
router.patch("/posts/:id/autosave", requireAuth, postController.autosave);
router.delete("/posts/:id", requireAuth, postController.remove);
router.post("/posts/:id/like", requireAuth, postController.like);
router.post("/posts/:id/bookmark", requireAuth, postController.bookmark);
router.get("/posts/:id/related", postController.related);
router.get("/posts/:id/comments", postController.listComments);
router.post("/posts/:id/comments", requireAuth, postController.addComment);
router.delete("/comments/:id", requireAuth, postController.removeComment);

export default router;
