export const calculateTopicInsights = (interviews) => {
  const topics = new Map();
  interviews.forEach((interview) => {
    const evaluation = interview.evaluations?.at(-1);
    if (!evaluation) return;
    evaluation.questions.forEach((feedback) => {
      const question = interview.generatedQuestions?.find((item) => item.id === feedback.questionId);
      const names = [...(question?.expectedTopics || []), ...(feedback.topicsToStudy || [])];
      [...new Set(names.map((name) => name.trim()).filter(Boolean))].forEach((name) => {
        const key = name.toLowerCase();
        const current = topics.get(key) || { topic: name, scoreTotal: 0, count: 0 };
        current.scoreTotal += feedback.score * 10;
        current.count += 1;
        topics.set(key, current);
      });
    });
  });
  const ranked = [...topics.values()].map((item) => ({
    topic: item.topic,
    score: Math.round(item.scoreTotal / item.count),
    questionCount: item.count,
  }));
  return {
    weakTopics: ranked.filter((item) => item.score < 75).sort((a, b) => a.score - b.score).slice(0, 4),
    strongTopics: ranked.filter((item) => item.score >= 75).sort((a, b) => b.score - a.score).slice(0, 4),
  };
};
