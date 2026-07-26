import mongoose from "mongoose";

const DATABASE_STATES = ["disconnected", "connected", "connecting", "disconnecting"];

export const getHealth = (req, res) => {
  void req;
  const databaseStatus = DATABASE_STATES[mongoose.connection.readyState] || "unknown";
  const healthy = databaseStatus === "connected";

  return res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    database: databaseStatus,
    version: "1.0.0",
    uptime: Math.floor(process.uptime()),
  });
};
