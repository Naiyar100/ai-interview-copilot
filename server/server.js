import dns from "node:dns";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import validateEnvironment from "./config/env.js";
import logger from "./config/logger.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config();
const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 5000;
let server;
let shuttingDown = false;

const shutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");

  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10000);
  forceExit.unref();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  const mongoose = await import("mongoose");
  await mongoose.default.connection.close();
  clearTimeout(forceExit);
  process.exit(exitCode);
};

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDB();

    server = app.listen(PORT, () => {
      logger.info({
        port: Number(PORT),
        publicRoutes: ["GET /", "GET /health", "GET /api/health"],
      }, "Server started");
    });
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.fatal({ err: error }, "Server startup failed");
    process.exit(1);
  }
};

process.on("unhandledRejection", (error) => {
  logger.fatal({ err: error }, "Unhandled promise rejection");
  void shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  void shutdown("uncaughtException", 1);
});

startServer();
