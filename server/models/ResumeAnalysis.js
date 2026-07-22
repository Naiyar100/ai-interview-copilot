import mongoose from "mongoose";

const keywordSchema = new mongoose.Schema({ keyword: { type: String, required: true }, count: { type: Number, min: 0, required: true } }, { _id: false });
const issueSchema = new mongoose.Schema({ category: { type: String, required: true }, severity: { type: String, enum: ["low", "medium", "high"], required: true }, message: { type: String, required: true } }, { _id: false });
const actionSuggestionSchema = new mongoose.Schema({ weak: { type: String, required: true }, replacement: { type: String, required: true }, reason: { type: String, required: true } }, { _id: false });
const aiSuggestionSchema = new mongoose.Schema({ type: { type: String, enum: ["summary", "experience", "skills", "keywords", "formatting"], required: true }, title: { type: String, required: true }, reason: { type: String, required: true }, example: { type: String, required: true }, priority: { type: String, enum: ["high", "medium", "low"], required: true } }, { _id: false });

const resumeAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  resume: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
  criteriaHash: { type: String, required: true },
  targetRole: { type: String, trim: true, maxlength: 120, default: "" },
  hasJobDescription: { type: Boolean, default: false },
  scores: {
    ats: { type: Number, min: 0, max: 100, required: true }, resume: { type: Number, min: 0, max: 100, required: true },
    keyword: { type: Number, min: 0, max: 100, required: true }, structure: { type: Number, min: 0, max: 100, required: true },
    content: { type: Number, min: 0, max: 100, required: true }, readability: { type: Number, min: 0, max: 100, required: true },
  },
  keywordAnalysis: { matched: { type: [keywordSchema], default: [] }, missing: { type: [String], default: [] }, coverage: { type: Number, min: 0, max: 100, required: true } },
  missingSkills: { type: [String], default: [] },
  actionVerbSuggestions: { type: [actionSuggestionSchema], default: [] },
  strengths: { type: [String], default: [] },
  issues: { type: [issueSchema], default: [] },
  metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  aiSuggestions: { type: [aiSuggestionSchema], default: [] },
  analyzedAt: { type: Date, default: Date.now },
}, { timestamps: true });

resumeAnalysisSchema.index({ user: 1, resume: 1, criteriaHash: 1 }, { unique: true });
resumeAnalysisSchema.index({ user: 1, analyzedAt: -1 });

export default mongoose.model("ResumeAnalysis", resumeAnalysisSchema);
