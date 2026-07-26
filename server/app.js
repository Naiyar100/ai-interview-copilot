import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import scheduledInterviewRoutes from "./routes/scheduledInterviewRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import coachRoutes from "./routes/coachRoutes.js";
import gamificationRoutes from "./routes/gamificationRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import logger from "./config/logger.js";
import { getHealth } from "./controllers/healthController.js";
import { errorHandler, notFoundHandler } from "./middleware/errorMiddleware.js";
import { preventNoSqlInjection, requireJsonContentType } from "./middleware/securityMiddleware.js";

const app = express();

const normalizeOrigin = (value) => {
  const candidate = value.trim().replace(/^(['"])(.*)\1$/, "$2");
  if (!candidate) return "";

  try {
    return new URL(candidate).origin;
  } catch {
    return candidate.replace(/\/+$/, "");
  }
};

const allowedOrigins = () => {
  const configuredOrigins = (process.env.CLIENT_URL || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  if (process.env.NODE_ENV !== "production") {
    configuredOrigins.push("http://localhost:5173");
  }

  return new Set(configuredOrigins);
};

app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

// Render probes and public uptime monitors must not depend on application
// middleware, authentication, CORS allowlists, or API rate limits.
app.get("/", (req, res) => {
  void req;
  return res.status(200).type("text/plain").send("AI Interview Copilot API is running");
});
app.get("/health", getHealth);

app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins().has(normalizeOrigin(origin))) return callback(null, true);
      const error = new Error("Origin is not allowed by CORS");
      error.statusCode = 403;
      return callback(error);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  }),
);
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const requestId = req.headers["x-request-id"] || crypto.randomUUID();
      res.setHeader("X-Request-Id", requestId);
      return requestId;
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url, remoteAddress: req.remoteAddress }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);
app.use(compression());
app.use(express.json({ limit: "100kb", strict: true }));
app.use(requireJsonContentType);
app.use(preventNoSqlInjection);

const rateLimitHandler = (req, res, next) => {
  void req;
  void res;
  const error = new Error("Too many requests. Please try again later.");
  error.statusCode = 429;
  next(error);
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 10000 : 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitHandler,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 10000 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitHandler,
});

app.use("/api", apiLimiter);
app.use("/health", healthRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/scheduled-interviews", scheduledInterviewRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/coach", coachRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/feedback", feedbackRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
