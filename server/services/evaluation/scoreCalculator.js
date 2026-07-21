export const calculateOverallScore = (questionFeedback) => {
  if (!Array.isArray(questionFeedback) || !questionFeedback.length) return 0;
  const total = questionFeedback.reduce((sum, question) => sum + question.score, 0);
  return Math.min(Math.max(Math.round((total / questionFeedback.length) * 10), 0), 100);
};
