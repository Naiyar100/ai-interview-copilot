import mongoose from "mongoose";

const userGoalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    goalType: { type: String, enum: ["questions"], default: "questions" },
    target: { type: Number, min: 1, max: 50, default: 5 },
    timezone: { type: String, trim: true, maxlength: 80, default: "UTC" },
  },
  { timestamps: true },
);

const UserGoal = mongoose.model("UserGoal", userGoalSchema);
export default UserGoal;
