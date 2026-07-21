import mongoose from "mongoose";

const userActivitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventKey: { type: String, required: true, maxlength: 180 },
    type: {
      type: String,
      required: true,
      enum: [
        "interview_created", "question_answered", "interview_completed",
        "evaluation_generated", "resume_uploaded", "voice_interview_completed",
        "daily_goal_completed", "badge_earned", "schedule_created",
      ],
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    relatedEntityType: { type: String, enum: ["interview", "resume", "badge", "schedule", null], default: null },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    xpAwarded: { type: Number, min: 0, default: 0 },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

userActivitySchema.index({ user: 1, eventKey: 1 }, { unique: true });
userActivitySchema.index({ user: 1, occurredAt: -1 });
userActivitySchema.index({ user: 1, type: 1, occurredAt: -1 });

const UserActivity = mongoose.model("UserActivity", userActivitySchema);
export default UserActivity;
