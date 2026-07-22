const SCORE_WEIGHTS = Object.freeze({ keyword: 0.35, structure: 0.25, content: 0.25, readability: 0.15 });
const RESUME_SCORE_WEIGHTS = Object.freeze({ structure: 0.35, content: 0.4, readability: 0.25 });

const ROLE_KEYWORDS = {
  frontend: ["javascript", "typescript", "react", "html", "css", "accessibility", "testing", "performance", "responsive", "api"],
  backend: ["node.js", "express", "api", "database", "mongodb", "sql", "security", "testing", "authentication", "scalability"],
  "full stack": ["javascript", "react", "node.js", "express", "api", "mongodb", "sql", "git", "testing", "deployment"],
  "data scientist": ["python", "sql", "machine learning", "statistics", "pandas", "numpy", "visualization", "modeling", "data analysis"],
  devops: ["aws", "azure", "docker", "kubernetes", "ci/cd", "linux", "monitoring", "terraform", "automation"],
  mobile: ["android", "ios", "react native", "flutter", "mobile", "api", "testing", "performance"],
};
const KNOWN_SKILLS = new Set(Object.values(ROLE_KEYWORDS).flat());
const STOP_WORDS = new Set(["and", "the", "with", "for", "from", "that", "this", "your", "you", "our", "are", "will", "have", "has", "job", "role", "work", "team", "experience", "years", "skills", "using", "into", "who", "but", "not", "all"]);
const STRONG_VERBS = ["achieved", "accelerated", "automated", "built", "delivered", "designed", "developed", "improved", "increased", "launched", "led", "optimized", "reduced", "resolved", "scaled"];
const WEAK_VERBS = [
  ["responsible for", "Led", "State ownership and the result you delivered."],
  ["worked on", "Developed", "Describe the specific contribution and outcome."],
  ["helped", "Collaborated", "Clarify your individual contribution."],
  ["made", "Built", "Use a precise action verb."],
  ["did", "Executed", "Name the actual action and result."],
  ["used", "Applied", "Explain how the technology created value."],
];

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
const unique = (values, limit = 30) => [...new Set(values.map((value) => value.toLowerCase().trim()).filter(Boolean))].slice(0, limit);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const countTerm = (text, term) => (text.match(new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(term)}(?=$|[^a-z0-9+#.])`, "gi")) || []).length;

const roleKeywords = (targetRole = "") => {
  const normalized = targetRole.toLowerCase();
  const exact = Object.entries(ROLE_KEYWORDS).find(([role]) => normalized.includes(role));
  return exact?.[1] || unique(normalized.match(/[a-z][a-z+#.]{2,}/g) || []).filter((term) => !STOP_WORDS.has(term));
};

const descriptionKeywords = (description = "") => {
  const words = description.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) || [];
  const counts = words.reduce((map, word) => { if (!STOP_WORDS.has(word)) map.set(word, (map.get(word) || 0) + 1); return map; }, new Map());
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([word]) => word);
};

const calculateStructure = (text, summary) => {
  const checks = {
    contact: /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text) && /(?:\+?\d[\d ()-]{7,}\d)/.test(text),
    skills: summary.skills.length > 0 || /(^|\n)\s*(technical )?skills\s*($|\n)/im.test(text),
    experience: summary.experience.length > 0 || /(^|\n)\s*(work |professional )?experience\s*($|\n)/im.test(text),
    education: summary.education.length > 0 || /(^|\n)\s*education\s*($|\n)/im.test(text),
    projects: summary.projects.length > 0 || /(^|\n)\s*projects?\s*($|\n)/im.test(text),
    links: /(linkedin\.com|github\.com|https?:\/\/)/i.test(text),
  };
  return { score: clamp((Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100), checks };
};

const calculateContent = (text) => {
  const words = text.match(/\b[\w+#.-]+\b/g) || [];
  const metricsCount = (text.match(/\b\d+(?:\.\d+)?%|\b\d+\+?\b/g) || []).length;
  const actionVerbCount = STRONG_VERBS.reduce((sum, verb) => sum + countTerm(text, verb), 0);
  const bulletCount = (text.match(/(^|\n)\s*[-*•▪◦]/g) || []).length;
  const lengthScore = words.length < 150 ? (words.length / 150) * 70 : words.length <= 1000 ? 100 : Math.max(55, 100 - (words.length - 1000) / 15);
  return { score: clamp(lengthScore * 0.4 + Math.min(metricsCount / 6, 1) * 30 + Math.min(actionVerbCount / 8, 1) * 20 + Math.min(bulletCount / 8, 1) * 10), words: words.length, metricsCount, actionVerbCount, bulletCount };
};

const calculateReadability = (text) => {
  const words = text.match(/\b[a-z]+\b/gi) || [];
  const sentences = text.split(/[.!?\n]+/).filter((item) => item.trim());
  const averageSentenceWords = words.length / Math.max(sentences.length, 1);
  const averageWordLength = words.reduce((sum, word) => sum + word.length, 0) / Math.max(words.length, 1);
  const sentenceScore = averageSentenceWords <= 22 ? 100 : Math.max(35, 100 - (averageSentenceWords - 22) * 4);
  const wordScore = averageWordLength <= 7 ? 100 : Math.max(45, 100 - (averageWordLength - 7) * 12);
  return { score: clamp(sentenceScore * 0.65 + wordScore * 0.35), averageSentenceWords: Number(averageSentenceWords.toFixed(1)), averageWordLength: Number(averageWordLength.toFixed(1)) };
};

export const calculateAtsAnalysis = ({ text, summary = {}, targetRole = "", jobDescription = "" }) => {
  const normalizedText = text.toLowerCase();
  const safeSummary = { skills: summary.skills || [], education: summary.education || [], experience: summary.experience || [], projects: summary.projects || [] };
  const requiredKeywords = unique([...roleKeywords(targetRole), ...descriptionKeywords(jobDescription)]);
  const matched = requiredKeywords.map((keyword) => ({ keyword, count: countTerm(normalizedText, keyword) })).filter((item) => item.count > 0);
  const missing = requiredKeywords.filter((keyword) => !matched.some((item) => item.keyword === keyword));
  const keywordScore = requiredKeywords.length ? clamp((matched.length / requiredKeywords.length) * 100) : clamp(Math.min((summary.keywords?.length || 0) / 12, 1) * 100);
  const structure = calculateStructure(text, safeSummary); const content = calculateContent(text); const readability = calculateReadability(text);
  const resumeScore = clamp(structure.score * RESUME_SCORE_WEIGHTS.structure + content.score * RESUME_SCORE_WEIGHTS.content + readability.score * RESUME_SCORE_WEIGHTS.readability);
  const atsScore = clamp(keywordScore * SCORE_WEIGHTS.keyword + structure.score * SCORE_WEIGHTS.structure + content.score * SCORE_WEIGHTS.content + readability.score * SCORE_WEIGHTS.readability);
  const actionVerbSuggestions = WEAK_VERBS.filter(([weak]) => normalizedText.includes(weak)).map(([weak, replacement, reason]) => ({ weak, replacement, reason }));
  if (!actionVerbSuggestions.length && content.actionVerbCount < 4) actionVerbSuggestions.push({ weak: "generic task descriptions", replacement: "Led, built, improved, or optimized", reason: "Start bullets with specific action verbs and finish with measurable outcomes." });
  const missingSkills = missing.filter((keyword) => KNOWN_SKILLS.has(keyword) || roleKeywords(targetRole).includes(keyword)).slice(0, 12);
  const strengths = [];
  if (structure.score >= 80) strengths.push("Core resume sections are easy for an ATS to identify.");
  if (content.metricsCount >= 3) strengths.push("Several achievements include measurable evidence.");
  if (keywordScore >= 75 && requiredKeywords.length) strengths.push("The resume covers most target keywords.");
  if (readability.score >= 80) strengths.push("Sentence length and wording are easy to scan.");
  const issues = [];
  if (!structure.checks.contact) issues.push({ category: "structure", severity: "high", message: "Add clearly formatted email and phone contact details." });
  if (!structure.checks.skills) issues.push({ category: "structure", severity: "high", message: "Add a clearly labeled Skills section." });
  if (content.words < 150) issues.push({ category: "content", severity: "high", message: "The resume has too little readable content for a strong review." });
  if (content.metricsCount < 2) issues.push({ category: "content", severity: "medium", message: "Add measurable outcomes such as percentages, time saved, volume, or scale." });
  if (missing.length) issues.push({ category: "keywords", severity: keywordScore < 50 ? "high" : "medium", message: `${missing.length} target keyword${missing.length === 1 ? " is" : "s are"} not represented.` });
  return {
    scores: { ats: atsScore, resume: resumeScore, keyword: keywordScore, structure: structure.score, content: content.score, readability: readability.score },
    keywordAnalysis: { matched, missing, coverage: keywordScore }, missingSkills, actionVerbSuggestions, strengths, issues,
    metrics: { wordCount: content.words, measurableAchievements: content.metricsCount, strongActionVerbs: content.actionVerbCount, bulletPoints: content.bulletCount, averageSentenceWords: readability.averageSentenceWords, requiredKeywordCount: requiredKeywords.length },
  };
};

export { SCORE_WEIGHTS, RESUME_SCORE_WEIGHTS };
