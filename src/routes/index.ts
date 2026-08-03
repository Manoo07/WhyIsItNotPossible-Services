import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import postsRouter from "./posts.js";
import categoriesRouter from "./categories.js";
import tagsRouter from "./tags.js";
import usersRouter from "./users.js";
import uploadRouter from "./upload.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(postsRouter);
router.use(categoriesRouter);
router.use(tagsRouter);
router.use(usersRouter);
router.use(uploadRouter);

export default router;
