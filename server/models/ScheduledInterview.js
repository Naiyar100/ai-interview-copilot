import mongoose from "mongoose";

const scheduledInterviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, required: true, trim: true, maxlength: 120 },
    interviewType: { type: String, required: true, enum: ["Technical", "Behavioral", "Mixed"] },
    difficulty: { type: String, required: true, enum: ["Easy", "Medium", "Hard"] },
    scheduledAt: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    reminderEnabled: { type: Boolean, default: false },
    status: { type: String, enum: ["scheduled", "cancelled", "started"], default: "scheduled" },
  },
  { timestamps: true },
);

scheduledInterviewSchema.index({ user: 1, status: 1, scheduledAt: 1 });

const ScheduledInterview = mongoose.model("ScheduledInterview", scheduledInterviewSchema);
export default ScheduledInterview;
