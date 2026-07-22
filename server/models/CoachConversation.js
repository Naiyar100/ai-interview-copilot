import mongoose from "mongoose";

const coachMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, trim: true, maxlength: 30000 },
    regenerated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const coachConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80, default: "New career conversation" },
    pinned: { type: Boolean, default: false },
    messages: { type: [coachMessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

coachConversationSchema.index({ user: 1, pinned: -1, lastMessageAt: -1 });
coachConversationSchema.index({ user: 1, title: 1 });

const CoachConversation = mongoose.model("CoachConversation", coachConversationSchema);
export default CoachConversation;
