const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const buildCsv = (analytics) => {
  const rows = [
    ["Analytics report"],
    ["Range", analytics.range.startDate || "All time", analytics.range.endDate || "Present"],
    ["Generated", analytics.generatedAt],
    [],
    ["Metric", "Value"],
    ...Object.entries(analytics.summary).filter(([, value]) => typeof value !== "object").map(([key, value]) => [key, value]),
    [],
    ["Topic", "Average score", "Attempts", "Mastery", "Confidence", "Last practiced"],
    ...analytics.topicMastery.map((topic) => [topic.topic, topic.averageScore, topic.attempts, topic.mastery, topic.confidence, topic.lastPracticedAt]),
    [],
    ["Recommendation", "Priority", "Evidence", "Action"],
    ...analytics.recommendations.map((item) => [item.title, item.priority, item.evidence, item.explanation]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
};

const safePdfText = (value) => String(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").replace(/[^\x20-\x7E]/g, "-");

const buildPdf = (user, analytics) => {
  const topTopics = analytics.topicMastery.slice(0, 5).map((topic) => `${topic.topic}: ${topic.averageScore}% (${topic.attempts} attempts)`);
  const readiness = analytics.roleReadiness.slice(0, 3).map((role) => `${role.role}: ${role.readinessScore}% - ${role.readinessLevel}`);
  const filters = Object.entries(analytics.filters).filter(([key, value]) => key !== "available" && value !== "" && value != null).map(([key, value]) => `${key}: ${value}`).join(", ");
  const lines = [
    "AI Interview Copilot - Analytics Report", `User: ${user.name}`, `Range: ${analytics.range.startDate || "All time"} to ${analytics.range.endDate || "Present"}`,
    `Filters: ${filters || "None"}`, `Generated: ${analytics.generatedAt}`, "", analytics.narrative, "", "Key metrics",
    `Interviews: ${analytics.summary.totalInterviews}`, `Completed: ${analytics.summary.completedInterviews} (${analytics.summary.completionRate}%)`,
    `Average score: ${analytics.summary.averageScore ?? "Not available"}`, `Practice time: ${analytics.summary.totalPracticeMinutes} minutes`,
    `Consistency: ${analytics.consistency.weeklyConsistencyScore}%`, "", "Topic mastery", ...topTopics, "", "Role readiness", ...readiness,
    "", "Recommendations", ...analytics.recommendations.slice(0, 5).map((item) => `${item.priority}: ${item.title} - ${item.evidence}`),
    "", "Readiness is an estimate based on practice data, not a hiring prediction.",
  ].map(safePdfText);
  const stream = ["BT", "/F1 11 Tf", "50 800 Td", ...lines.flatMap((line, index) => {
    if (index === 0) return ["/F1 16 Tf", `(${line}) Tj`, "/F1 11 Tf", "0 -28 Td"];
    return [`(${line.slice(0, 105)}) Tj`, "0 -16 Td"];
  }), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
};

export const createAnalyticsExport = (format, user, analytics) => {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") return { filename: `interview-analytics-${stamp}.csv`, mimeType: "text/csv;charset=utf-8", buffer: Buffer.from(buildCsv(analytics)) };
  if (format === "json") return { filename: `interview-analytics-${stamp}.json`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(analytics, null, 2)) };
  if (format === "pdf") return { filename: `interview-analytics-${stamp}.pdf`, mimeType: "application/pdf", buffer: buildPdf(user, analytics) };
  const error = new Error("Export format must be pdf, csv, or json"); error.statusCode = 400; throw error;
};
