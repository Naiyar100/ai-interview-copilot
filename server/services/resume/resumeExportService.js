const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const safePdfText = (value) => String(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").replace(/[^\x20-\x7E]/g, "-");
const wrap = (value, width = 88) => {
  const words = safePdfText(value).split(/\s+/); const lines = []; let line = "";
  words.forEach((word) => { if (`${line} ${word}`.trim().length > width && line) { lines.push(line); line = word; } else line = `${line} ${word}`.trim(); });
  if (line) lines.push(line); return lines;
};

const reportLines = (resume, analysis) => [
  `Resume: ${resume.originalFileName} (version ${resume.version || 1})`, `Target role: ${analysis.targetRole || "General ATS review"}`, `Analyzed: ${new Date(analysis.analyzedAt).toISOString()}`, "",
  "SCORES", `ATS score: ${analysis.scores.ats}/100`, `Resume score: ${analysis.scores.resume}/100`, `Keyword match: ${analysis.scores.keyword}/100`, `Structure: ${analysis.scores.structure}/100`, `Content: ${analysis.scores.content}/100`, `Readability: ${analysis.scores.readability}/100`, "",
  "KEYWORD ANALYSIS", `Matched: ${analysis.keywordAnalysis.matched.map((item) => item.keyword).join(", ") || "No target keywords matched"}`, `Missing: ${analysis.keywordAnalysis.missing.join(", ") || "None identified"}`, "",
  "MISSING SKILLS", ...(analysis.missingSkills.length ? analysis.missingSkills.map((item) => `- ${item}`) : ["None identified for the supplied target criteria"]), "",
  "ACTION VERB SUGGESTIONS", ...analysis.actionVerbSuggestions.map((item) => `- Replace ${item.weak} with ${item.replacement}. ${item.reason}`), "",
  "ISSUES", ...(analysis.issues.length ? analysis.issues.map((item) => `- ${item.severity.toUpperCase()}: ${item.message}`) : ["No major deterministic issues detected"]), "",
  "AI IMPROVEMENT SUGGESTIONS", ...(analysis.aiSuggestions.length ? analysis.aiSuggestions.map((item) => `- ${item.priority.toUpperCase()} ${item.title}: ${item.reason} Example: ${item.example}`) : ["Generate AI suggestions from the ATS Reviewer to add this section"]), "",
  "Scoring note: ATS score is an explainable estimate, not a guarantee of recruiter or hiring-system outcomes.",
].flatMap((line) => wrap(line));

const buildPdf = (resume, analysis) => {
  const lines = reportLines(resume, analysis); const linesPerPage = 39; const pages = [];
  for (let index = 0; index < lines.length; index += linesPerPage) pages.push(lines.slice(index, index + linesPerPage));
  const fontId = 3 + pages.length * 2; const pageIds = pages.map((_, index) => 3 + index * 2);
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`];
  pages.forEach((pageLines, pageIndex) => {
    const pageId = pageIds[pageIndex]; const contentId = pageId + 1;
    const content = ["0.10 0.12 0.22 rg", "0 738 612 54 re f", "BT", "/F1 16 Tf", "1 1 1 rg", "44 763 Td", "(AI Interview Copilot - ATS Resume Review) Tj", "ET", "BT", "/F1 10 Tf", "0.12 0.14 0.23 rg", "44 714 Td", ...pageLines.flatMap((line) => [`(${line}) Tj`, "0 -16 Td"]), "ET", "BT", "/F1 8 Tf", "0.4 0.43 0.52 rg", `44 24 Td`, `(Page ${pageIndex + 1} of ${pages.length}) Tj`, "ET"].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
};

const buildCsv = (resume, analysis) => {
  const rows = [["ATS Resume Review"], ["Resume", resume.originalFileName], ["Version", resume.version || 1], ["Target role", analysis.targetRole || "General"], ["Analyzed", analysis.analyzedAt], [], ["Score", "Value"], ...Object.entries(analysis.scores), [], ["Matched keyword", "Occurrences"], ...analysis.keywordAnalysis.matched.map((item) => [item.keyword, item.count]), [], ["Missing keywords"], ...analysis.keywordAnalysis.missing.map((item) => [item]), [], ["Issue category", "Severity", "Message"], ...analysis.issues.map((item) => [item.category, item.severity, item.message]), [], ["AI suggestion", "Priority", "Reason", "Example"], ...analysis.aiSuggestions.map((item) => [item.title, item.priority, item.reason, item.example])];
  return Buffer.from(rows.map((row) => row.map(csvEscape).join(",")).join("\r\n"));
};

export const createResumeExport = (format, resume, analysis) => {
  const stamp = new Date().toISOString().slice(0, 10); const base = `ats-resume-review-v${resume.version || 1}-${stamp}`;
  if (format === "pdf") return { filename: `${base}.pdf`, mimeType: "application/pdf", buffer: buildPdf(resume, analysis) };
  if (format === "csv") return { filename: `${base}.csv`, mimeType: "text/csv;charset=utf-8", buffer: buildCsv(resume, analysis) };
  const error = new Error("Export format must be pdf or csv"); error.statusCode = 400; throw error;
};
