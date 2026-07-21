import mongoose from "mongoose";
import { sendSuccess } from "../utils/apiResponse.js";

const DATABASE_STATES = ["disconnected", "connected", "connecting", "disconnecting"];

export const getHealth = (req, res) => {
  const databaseStatus = DATABASE_STATES[mongoose.connection.readyState] || "unknown";
  const aiProviderStatus = process.env.GEMINI_API_KEY?.trim()
    ? "configured"
    : "not_configured";
  const memory = process.memoryUsage();
  const healthy = databaseStatus === "connected";

  return sendSuccess(res, healthy ? 200 : 503, healthy ? "Service is healthy" : "Service is degraded", {
    status: healthy ? "ok" : "degraded",
    database: databaseStatus,
    aiProvider: aiProviderStatus,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
    },
    timestamp: new Date().toISOString(),
  });
};
