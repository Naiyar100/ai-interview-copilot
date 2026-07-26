import Feedback from "../models/Feedback.js";

const feedbackFields = [
  "rating",
  "liked",
  "improvements",
  "foundBug",
  "bugDescription",
  "pageOrFeature",
];

export const createFeedback = async ({ user, input }) => {
  const feedbackInput = feedbackFields.reduce(
    (result, field) =>
      input[field] === undefined ? result : { ...result, [field]: input[field] },
    {},
  );

  return Feedback.create({
    ...feedbackInput,
    user: user._id,
    userName: user.name,
    userEmail: user.email,
  });
};
