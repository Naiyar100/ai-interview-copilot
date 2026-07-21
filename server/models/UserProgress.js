import mongoose from "mongoose";

const userProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    xp: { type: Number, min: 0, default: 0 },
    level: { type: Number, min: 1, default: 1 },
    currentStreak: { type: Number, min: 0, default: 0 },
    longestStreak: { type: Number, min: 0, default: 0 },
    lastActiveDate: { type: String, default: null },
    questionsAnswered: { type: Number, min: 0, default: 0 },
    totalPracticeMinutes: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

const UserProgress = mongoose.model("UserProgress", userProgressSchema);
export default UserProgress;
