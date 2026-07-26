import { createFeedback } from "../services/feedbackService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const submitFeedback = async (req, res) => {
  const feedback = await createFeedback({
    user: req.user,
    input: req.body,
  });

  req.log?.info(
    {
      event: "feedback.submitted",
      feedbackId: feedback._id.toString(),
      userId: req.user._id.toString(),
    },
    "User feedback submitted",
  );

  return sendSuccess(res, 201, "Thank you for your feedback", {
    feedback: {
      id: feedback._id,
      rating: feedback.rating,
      createdAt: feedback.createdAt,
    },
  });
};
