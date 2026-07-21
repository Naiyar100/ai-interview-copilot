import mongoose from "mongoose";
import logger from "./logger.js";

const connectDB = async () => {
  const { MONGODB_URI } = process.env;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in the environment variables");
  }

  const connection = await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  logger.info({ host: connection.connection.host }, "MongoDB connected");
  return connection;
};

export default connectDB;
