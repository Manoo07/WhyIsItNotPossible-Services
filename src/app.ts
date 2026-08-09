import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";
import { apiLimiter } from "./middleware/rate-limit.middleware.js";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

// Comma-separated for multi-origin setups (e.g. www + apex, staging + prod).
// Falls back to FRONTEND_URL (already required by the notification emails)
// so there's one fewer env var to remember to set.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app: Express = express();

app.use(helmet());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header at all means a same-origin or non-browser request
      // (curl, server-to-server, mobile app) — the browser is what actually
      // enforces CORS, so there's nothing to check for those.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", apiLimiter);
app.use("/api", router);
app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
