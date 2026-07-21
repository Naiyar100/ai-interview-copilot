import dotenv from "dotenv";
import connectDB from "./config/db.js";
import validateEnvironment from "./config/env.js";
import logger from "./config/logger.js";

dotenv.config();
const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDB();

    const server = app.listen(PORT, () => {
      logger.info({ port: Number(PORT) }, "Server started");
    });
    const shutdown = async (signal) => {
      logger.info({ signal }, "Graceful shutdown started");
      server.close(async () => {
        const mongoose = await import("mongoose");
        await mongoose.default.connection.close();
        process.exit(0);
      });
    };
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.fatal({ err: error }, "Server startup failed");
    process.exit(1);
  }
};

startServer();
