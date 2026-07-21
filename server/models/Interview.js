import mongoose from "mongoose";

const generatedQuestionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, min: 1 },
    question: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true,
    },
    expectedTopics: { type: [String], default: [] },
  },
  { _id: false },
);

const evaluationQuestionSchema = new mongoose.Schema(
  {
    questionId: { type: Number, required: true, min: 1 },
    score: { type: Number, required: true, min: 0, max: 10 },
    feedback: { type: String, required: true, trim: true },
    idealAnswer: { type: String, required: true, trim: true },
    topicsToStudy: { type: [String], default: [] },
  },
  { _id: false },
);

const evaluationSchema = new mongoose.Schema(
  {
    overallScore: { type: Number, required: true, min: 0, max: 100 },
    summary: { type: String, required: true, trim: true },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    questions: { type: [evaluationQuestionSchema], required: true },
    evaluatedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const voiceMetadataSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ["text", "voice"], default: "text" },
    language: { type: String, trim: true, default: "en-US" },
    speakingRate: { type: Number, min: 0.5, max: 2, default: 1 },
    muted: { type: Boolean, default: false },
    autoPlayQuestions: { type: Boolean, default: true },
    recordingAttempts: { type: Number, min: 0, default: 0 },
    lastRecordedAt: { type: Date, default: null },
  },
  { _id: false },
);

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    resume: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      default: null,
    },
    resumeSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    experienceLevel: {
      type: String,
      trim: true,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true,
    },
    interviewType: {
      type: String,
      enum: ["Technical", "Behavioral", "Mixed"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "completed"],
      default: "draft",
    },
    aiFeedback: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    evaluations: {
      type: [evaluationSchema],
      default: [],
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    duration: {
      type: Number,
      min: 0,
      default: null,
    },
    totalQuestions: {
      type: Number,
      min: 1,
      default: 1,
    },
    answeredQuestions: {
      type: Number,
      min: 0,
      default: 0,
    },
    questions: {
      type: [String],
      default: [],
    },
    generatedQuestions: {
      type: [generatedQuestionSchema],
      default: [],
    },
    questionsGeneratedAt: {
      type: Date,
      default: null,
    },
    answers: {
      type: [String],
      default: [],
    },
    transcripts: {
      type: [String],
      default: [],
    },
    voiceMetadata: {
      type: voiceMetadataSchema,
      default: () => ({}),
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

interviewSchema.index({ user: 1, createdAt: -1 });
interviewSchema.index({ user: 1, status: 1, createdAt: -1 });
interviewSchema.index({ user: 1, difficulty: 1, createdAt: -1 });
interviewSchema.index({ user: 1, role: 1 });
interviewSchema.index({ user: 1, resume: 1 });
interviewSchema.index({ user: 1, score: -1 });
interviewSchema.index({ user: 1, "evaluations.evaluatedAt": -1 });
interviewSchema.index({ user: 1, interviewType: 1, createdAt: -1 });

const Interview = mongoose.model("Interview", interviewSchema);

export default Interview;
