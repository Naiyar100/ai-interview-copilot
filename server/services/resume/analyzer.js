const SECTION_ALIASES = {
  skills: ["skills", "technical skills", "core competencies"],
  education: ["education", "academic background", "qualifications"],
  experience: ["experience", "work experience", "professional experience", "employment"],
  projects: ["projects", "personal projects", "academic projects"],
  certifications: ["certifications", "certificates", "licenses"],
};

const TECHNOLOGIES = [
  "JavaScript", "TypeScript", "React", "Angular", "Vue", "Node.js",
  "Express", "MongoDB", "MySQL", "PostgreSQL", "Python", "Java", "C++",
  "C#", "AWS", "Azure", "Docker", "Kubernetes", "Git", "HTML", "CSS",
  "REST", "GraphQL", "Redis", "Firebase", "Django", "Flask", "Spring",
];

const STOP_WORDS = new Set([
  "and", "the", "with", "for", "from", "that", "this", "using", "into",
  "your", "have", "has", "was", "were", "are", "but", "not", "you",
  "resume", "email", "phone", "www", "com", "work", "worked",
]);

const normalizeHeading = (line) =>
  line.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

const findSection = (line) => {
  const heading = normalizeHeading(line);
  return Object.entries(SECTION_ALIASES).find(([, aliases]) =>
    aliases.includes(heading),
  )?.[0];
};

const cleanEntry = (line) => line.replace(/^[\s•·▪◦*-]+/, "").trim();

const extractSections = (text) => {
  const sections = Object.fromEntries(
    Object.keys(SECTION_ALIASES).map((section) => [section, []]),
  );
  let currentSection = null;

  text.split("\n").forEach((line) => {
    const section = findSection(line);
    if (section) {
      currentSection = section;
      return;
    }
    const entry = cleanEntry(line);
    if (currentSection && entry) sections[currentSection].push(entry);
  });

  return sections;
};

const unique = (values, limit = 20) =>
  [...new Map(values.filter(Boolean).map((value) => [value.toLowerCase(), value])).values()]
    .slice(0, limit);

const extractSkills = (lines) => unique(
  lines.flatMap((line) => line.split(/[,|•·]/)).map(cleanEntry).filter((item) => item.length <= 60),
);

const extractTechnologies = (text) => {
  const normalizedText = text.toLowerCase();
  return TECHNOLOGIES.filter((technology) => {
    const pattern = new RegExp(`(^|[^a-z0-9+#.])${technology.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+#.]|$)`, "i");
    return pattern.test(normalizedText);
  });
};

const extractKeywords = (text) => {
  const counts = new Map();
  const words = text.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) || [];
  words.forEach((word) => {
    if (!STOP_WORDS.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([word]) => word);
};

export const analyzeResume = (extractedText) => {
  const sections = extractSections(extractedText);
  return {
    skills: extractSkills(sections.skills),
    education: unique(sections.education, 12),
    experience: unique(sections.experience, 20),
    projects: unique(sections.projects, 16),
    certifications: unique(sections.certifications, 12),
    technologies: extractTechnologies(extractedText),
    keywords: extractKeywords(extractedText),
  };
};

export const buildResumeContext = (summary = {}) =>
  [
    ["Skills", summary.skills],
    ["Technologies", summary.technologies],
    ["Experience", summary.experience],
    ["Projects", summary.projects],
    ["Education", summary.education],
    ["Certifications", summary.certifications],
  ]
    .filter(([, values]) => Array.isArray(values) && values.length)
    .map(([label, values]) => `${label}: ${values.slice(0, 8).join("; ")}`)
    .join("\n")
    .slice(0, 6000);
