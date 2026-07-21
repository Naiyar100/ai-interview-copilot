import mongoose from "mongoose";

const analyticsSavedViewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    filters: {
      preset: { type: String, default: "30d" },
      startDate: { type: String, default: "" },
      endDate: { type: String, default: "" },
      role: { type: String, default: "" },
      interviewType: { type: String, default: "" },
      difficulty: { type: String, default: "" },
      status: { type: String, default: "" },
      category: { type: String, default: "" },
      resumeId: { type: String, default: "" },
      voiceMode: { type: String, default: "" },
      scoreMin: { type: Number, default: null },
      scoreMax: { type: Number, default: null },
      timezone: { type: String, default: "UTC" },
      aggregation: { type: String, enum: ["day", "week", "month"], default: "day" },
    },
  },
  { timestamps: true },
);

analyticsSavedViewSchema.index({ user: 1, createdAt: -1 });
analyticsSavedViewSchema.index({ user: 1, name: 1 }, { unique: true });

const AnalyticsSavedView = mongoose.model("AnalyticsSavedView", analyticsSavedViewSchema);
export default AnalyticsSavedView;
