import mongoose from "mongoose";

const resumeSummarySchema = new mongoose.Schema(
  {
    skills: { type: [String], default: [] },
    education: { type: [String], default: [] },
    experience: { type: [String], default: [] },
    projects: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    technologies: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
  },
  { _id: false },
);

const resumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalFileName: { type: String, required: true, trim: true },
    storedFileName: { type: String, required: true, select: false },
    fileSize: { type: Number, required: true, min: 1 },
    mimeType: { type: String, required: true, enum: ["application/pdf"] },
    checksum: { type: String, required: true, select: false },
    extractedText: { type: String, required: true, select: false },
    summary: { type: resumeSummarySchema, default: () => ({}) },
    extractionStatus: {
      type: String,
      enum: ["ready"],
      default: "ready",
    },
    isActive: { type: Boolean, default: false },
    uploadDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

resumeSchema.index({ user: 1, createdAt: -1 });
resumeSchema.index({ user: 1, checksum: 1 }, { unique: true });
resumeSchema.index(
  { user: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

const Resume = mongoose.model("Resume", resumeSchema);

export default Resume;
