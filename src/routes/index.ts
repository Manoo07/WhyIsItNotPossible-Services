import { Router, type IRouter } from "express";
import healthRouter from "./health.routes.js";
import authRouter from "./auth.routes.js";
import postRouter from "./post.routes.js";
import categoryRouter from "./category.routes.js";
import tagRouter from "./tag.routes.js";
import userRouter from "./user.routes.js";
import uploadRouter from "./upload.routes.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(postRouter);
router.use(categoryRouter);
router.use(tagRouter);
router.use(userRouter);
router.use(uploadRouter);

export default router;
