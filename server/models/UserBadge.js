import mongoose from "mongoose";

const userBadgeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    badgeKey: { type: String, required: true, trim: true },
    earnedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

userBadgeSchema.index({ user: 1, badgeKey: 1 }, { unique: true });

const UserBadge = mongoose.model("UserBadge", userBadgeSchema);
export default UserBadge;
