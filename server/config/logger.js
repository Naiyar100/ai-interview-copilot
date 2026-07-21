import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "*.password",
      "*.token",
      "GEMINI_API_KEY",
      "JWT_SECRET",
    ],
    censor: "[REDACTED]",
  },
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
