import mongoose from "mongoose";

const challengeClaimSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    challengeKey: { type: String, required: true, trim: true },
    periodKey: { type: String, required: true, trim: true },
    xpAwarded: { type: Number, required: true, min: 0 },
    claimedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

challengeClaimSchema.index({ user: 1, challengeKey: 1, periodKey: 1 }, { unique: true });
challengeClaimSchema.index({ user: 1, claimedAt: -1 });

const ChallengeClaim = mongoose.model("ChallengeClaim", challengeClaimSchema);
export default ChallengeClaim;
