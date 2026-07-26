import Feedback from "../models/Feedback.js";

export const createFeedback = async ({ user, input }) => {
  return Feedback.create({
    user: user._id,
    name: input.name,
    email: input.email,
    feedback: input.feedback,
  });
};
