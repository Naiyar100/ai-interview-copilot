import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import logger from "./config/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorMiddleware.js";
import { preventNoSqlInjection, requireJsonContentType } from "./middleware/securityMiddleware.js";

const app = express();

const allowedOrigins = () =>
  (process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins().includes(origin)) return callback(null, true);
      const error = new Error("Origin is not allowed by CORS");
      error.statusCode = 403;
      return callback(error);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
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
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/scheduled-interviews", scheduledInterviewRoutes);
app.use("/api/analytics", analyticsRoutes);
app.get("/", (req, res) => res.type("text/plain").send("AI Interview Copilot API is running"));

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
