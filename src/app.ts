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

// Required behind the Nginx reverse proxy so req.ip / req.secure reflect
// the real client (X-Forwarded-For) instead of the proxy's own address —
// otherwise every request looks like it comes from one IP (breaks
// apiLimiter/authLimiter/otpLimiter) and req.secure is always false.
// `1` trusts exactly one hop, matching the single nginx container in front
// of this app.
app.set("trust proxy", 1);

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

// Deliberately its own flag, not tied to NODE_ENV: this app runs in
// production over plain HTTP for a while (deployed to an EC2 IP, no
// domain/TLS yet), and a `secure` cookie is silently dropped by the
// browser over HTTP — session/login would appear to work (200 response)
// but never actually persist. Defaults to on for production so a deploy
// that forgets to set this stays secure-by-default once TLS is in place;
// set COOKIE_SECURE=false explicitly for the HTTP-only interim period.
const cookieSecure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: cookieSecure,
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
