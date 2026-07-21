import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, jest } from "@jest/globals";
import connectDB from "../config/db.js";

beforeAll(async () => {
  await connectDB();
});

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
  jest.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.connection.close();
});
