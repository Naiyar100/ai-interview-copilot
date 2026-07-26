import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    liked: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    improvements: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    foundBug: {
      type: Boolean,
      required: true,
      default: false,
    },
    bugDescription: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    pageOrFeature: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
  },
  { timestamps: true },
);

feedbackSchema.index({ user: 1, createdAt: -1 });

const Feedback = mongoose.model("Feedback", feedbackSchema);

export default Feedback;
