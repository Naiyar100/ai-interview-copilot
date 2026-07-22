import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  analyzeResumeForAts,
  compareResumeVersions,
  deleteResume,
  downloadBase64File,
  exportResumeReview,
  getResumes,
  improveResumeWithAi,
  setActiveResume,
  uploadResume,
} from "../services/api";
import { useTheme } from "../context/ThemeContext";
import "./Resumes.css";

const formatSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(Math.round(bytes / 1024), 1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));

function ScoreRing({ label, value, primary = false }) {
  return <div className={`ats-score ${primary ? "primary" : ""}`} style={{ "--score": `${value || 0}%` }}><div><strong>{value ?? 0}</strong><small>/100</small></div><span>{label}</span></div>;
}

function AnalysisPanel({ analysis, improving, exporting, onImprove, onExport }) {
  if (!analysis) return <section className="ats-empty"><h2>No ATS review selected</h2><p>Select a resume and run an analysis to see explainable scores and improvements.</p></section>;
  return <section className="ats-results" aria-label="ATS analysis results">
    <div className="ats-results-head"><div><span>Latest analysis</span><h2>{analysis.targetRole ? `${analysis.targetRole} review` : "General ATS review"}</h2><p>Analyzed {formatDate(analysis.analyzedAt)}</p></div><div className="ats-export"><button type="button" disabled={exporting} onClick={() => onExport("pdf")}>Export PDF</button><button type="button" disabled={exporting} onClick={() => onExport("csv")}>Export CSV</button></div></div>
    <div className="ats-scores"><ScoreRing label="ATS score" value={analysis.scores.ats} primary /><ScoreRing label="Resume score" value={analysis.scores.resume} /><ScoreRing label="Keywords" value={analysis.scores.keyword} /><ScoreRing label="Structure" value={analysis.scores.structure} /><ScoreRing label="Content" value={analysis.scores.content} /><ScoreRing label="Readability" value={analysis.scores.readability} /></div>
    <div className="ats-grid">
      <article><h3>Keyword analysis</h3><p className="ats-caption">{analysis.keywordAnalysis.coverage}% coverage for the supplied criteria</p><div className="keyword-group"><strong>Matched</strong><div>{analysis.keywordAnalysis.matched.length ? analysis.keywordAnalysis.matched.map((item) => <span className="keyword matched" key={item.keyword}>{item.keyword} <small>{item.count}</small></span>) : <em>No target keywords matched</em>}</div></div><div className="keyword-group"><strong>Missing</strong><div>{analysis.keywordAnalysis.missing.length ? analysis.keywordAnalysis.missing.map((item) => <span className="keyword missing" key={item}>{item}</span>) : <em>No missing target keywords</em>}</div></div></article>
      <article><h3>Missing skills</h3>{analysis.missingSkills.length ? <ul>{analysis.missingSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p className="ats-caption">No target-role skill gaps were detected.</p>}<h3 className="ats-subheading">Action verbs</h3><ul>{analysis.actionVerbSuggestions.map((item) => <li key={item.weak}><strong>{item.replacement}</strong><span>Instead of “{item.weak}” - {item.reason}</span></li>)}</ul></article>
      <article><h3>Priority issues</h3>{analysis.issues.length ? <ul className="issue-list">{analysis.issues.map((item, index) => <li className={item.severity} key={`${item.category}-${index}`}><span>{item.severity}</span><p>{item.message}</p></li>)}</ul> : <p className="ats-caption">No major deterministic issues were detected.</p>}<h3 className="ats-subheading">Strengths</h3><ul>{analysis.strengths.map((item) => <li key={item}>{item}</li>)}</ul></article>
      <article className="ai-improvements"><div className="ai-title"><div><span>AI</span><h3>Improvement suggestions</h3></div><button type="button" disabled={improving} onClick={onImprove}>{improving ? "Generating..." : analysis.aiSuggestions.length ? "Regenerate" : "Generate suggestions"}</button></div>{analysis.aiSuggestions.length ? <div className="suggestion-list">{analysis.aiSuggestions.map((item) => <div key={item.title}><span className={`priority ${item.priority}`}>{item.priority}</span><h4>{item.title}</h4><p>{item.reason}</p><blockquote>{item.example}</blockquote></div>)}</div> : <p className="ats-caption">Generate grounded suggestions. Missing facts remain explicit placeholders.</p>}</article>
    </div><p className="ats-disclaimer">ATS and resume scores are explainable estimates, not guarantees of recruiter or hiring-system outcomes.</p>
  </section>;
}

function Resumes() {
  const fileInput = useRef(null);
  const { preference, setPreference } = useTheme();
  const [resumes, setResumes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [compareIds, setCompareIds] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [improving, setImproving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const loadResumes = useCallback(async () => {
    try {
      const response = await getResumes();
      const items = response.data.resumes;
      setResumes(items);
      setSelectedId((current) => current && items.some((item) => item.id === current) ? current : items.find((item) => item.isActive)?.id || items[0]?.id || "");
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Unable to load resumes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(loadResumes, 0);
    return () => window.clearTimeout(request);
  }, [loadResumes]);

  const selectedResume = resumes.find((resume) => resume.id === selectedId);
  const currentAnalysis = analysis && String(analysis.resumeId) === selectedId ? analysis : selectedResume?.latestAnalysis || null;
  const selectResume = (resumeId) => { setSelectedId(resumeId); setAnalysis(null); setComparison(null); };

  const handleAnalyze = async () => {
    if (!selectedId) return;
    setAnalyzing(true); setError(""); setStatus("");
    try { const response = await analyzeResumeForAts(selectedId, targetRole, jobDescription); setAnalysis(response.data.analysis); setStatus("ATS analysis updated for the selected criteria."); }
    catch (requestError) { setError(requestError.message || "Unable to analyze resume"); }
    finally { setAnalyzing(false); }
  };

  const handleImprove = async () => {
    setImproving(true); setError("");
    try { const response = await improveResumeWithAi(selectedId, targetRole, jobDescription); setAnalysis(response.data.analysis); setStatus("AI improvement suggestions generated."); }
    catch (requestError) { setError(requestError.message || "Unable to generate improvements"); }
    finally { setImproving(false); }
  };

  const handleExport = async (format) => {
    setExporting(true); setError("");
    try { const response = await exportResumeReview(selectedId, format, targetRole, jobDescription); downloadBase64File(response.data); setStatus(`${format.toUpperCase()} report downloaded.`); }
    catch (requestError) { setError(requestError.message || "Unable to export ATS report"); }
    finally { setExporting(false); }
  };

  const handleCompare = async () => {
    if (compareIds.length < 2) return;
    setAnalyzing(true); setError("");
    try { const response = await compareResumeVersions(compareIds, targetRole, jobDescription); setComparison(response.data); }
    catch (requestError) { setError(requestError.message || "Unable to compare resume versions"); }
    finally { setAnalyzing(false); }
  };

  const toggleComparison = (resumeId) => setCompareIds((items) => items.includes(resumeId) ? items.filter((id) => id !== resumeId) : items.length < 4 ? [...items, resumeId] : items);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError("");
    setStatus("");
    try {
      await uploadResume(file, setProgress);
      setStatus("Resume uploaded, versioned, analyzed, and selected for future interviews.");
      await loadResumes();
    } catch (requestError) {
      setError(requestError.message || "Unable to upload resume");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleActivate = async (resumeId) => {
    setBusyId(resumeId);
    setError("");
    try {
      await setActiveResume(resumeId);
      setStatus("Active resume updated.");
      await loadResumes();
    } catch (requestError) {
      setError(requestError.message || "Unable to select resume");
    } finally {
      setBusyId("");
    }
  };

  const handleDelete = async (resume) => {
    if (!window.confirm(`Delete ${resume.originalFileName}? The stored PDF will also be removed.`)) {
      return;
    }
    setBusyId(resume.id);
    setError("");
    try {
      await deleteResume(resume.id);
      setCompareIds((items) => items.filter((id) => id !== resume.id));
      setStatus("Resume version deleted.");
      await loadResumes();
    } catch (requestError) {
      setError(requestError.message || "Unable to delete resume");
    } finally {
      setBusyId("");
    }
  };

  return (
    <main className="resume-page">
      <section className="resume-shell">
        <div className="resume-topbar">
          <Link to="/dashboard">← Back to Dashboard</Link>
          <label><span className="sr-only">Color theme</span><select aria-label="Color theme" value={preference} onChange={(event) => setPreference(event.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        </div>

        <span className="resume-eyebrow">ATS Resume Reviewer</span>
        <h1>Build a resume that gets understood</h1>
        <p className="resume-description">
          Upload private PDF versions, measure ATS compatibility, compare improvements,
          and get grounded suggestions without inventing missing experience.
        </p>

        <label className={`resume-upload ${uploading ? "uploading" : ""}`}>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            onChange={handleUpload}
          />
          <strong>{uploading ? "Extracting and analyzing resume..." : "Upload a new PDF version"}</strong>
          <span>PDF only, maximum 5 MB. The upload becomes your active interview resume.</span>
          {uploading && (
            <div className="resume-progress" aria-label={`Upload ${progress}% complete`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
        </label>

        {error && <p className="resume-error" role="alert">{error}</p>}
        {status && <p className="resume-success" role="status">{status}</p>}

        {!loading && resumes.length > 0 && <>
          <section className="ats-controls" aria-labelledby="analysis-title">
            <div><span>Targeted review</span><h2 id="analysis-title">Analyze version {selectedResume?.version || 1}</h2></div>
            <div className="ats-fields">
              <label>Resume version<select value={selectedId} onChange={(event) => selectResume(event.target.value)}>{resumes.map((resume) => <option value={resume.id} key={resume.id}>v{resume.version || 1} - {resume.originalFileName}</option>)}</select></label>
              <label>Target role<input maxLength="120" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Frontend Developer" /></label>
              <label className="job-description">Job description <small>Optional</small><textarea maxLength="12000" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the target job description for keyword matching" /></label>
            </div>
            <button className="ats-primary" type="button" disabled={analyzing} onClick={handleAnalyze}>{analyzing ? "Analyzing..." : "Run ATS analysis"}</button>
          </section>
          <AnalysisPanel analysis={currentAnalysis} improving={improving} exporting={exporting} onImprove={handleImprove} onExport={handleExport} />
        </>}

        {loading ? (
          <div className="resume-empty" role="status">Loading resume reviewer...</div>
        ) : resumes.length === 0 ? (
          <div className="resume-empty">
            <h2>No resume versions yet</h2>
            <p>Upload a text-based PDF to generate your first private ATS review.</p>
          </div>
        ) : (
          <section className="resume-history">
            <div className="history-heading"><div><span>Database-backed history</span><h2>Resume versions</h2><p>Select 2 to 4 versions for an ATS score comparison.</p></div><button type="button" disabled={compareIds.length < 2 || analyzing} onClick={handleCompare}>Compare selected ({compareIds.length})</button></div>
            {comparison && <div className="comparison-table" role="table" aria-label="Resume version comparison"><div role="row"><strong>Version</strong><strong>ATS</strong><strong>Resume</strong><strong>Keywords</strong><strong>Change</strong></div>{comparison.comparison.map((item) => <div role="row" className={comparison.recommendedResumeId === item.resumeId ? "recommended" : ""} key={item.resumeId}><span>v{item.version}{comparison.recommendedResumeId === item.resumeId && <small>Recommended</small>}</span><b>{item.scores.ats}</b><b>{item.scores.resume}</b><b>{item.scores.keyword}</b><span className={item.changeFromFirst.ats >= 0 ? "positive" : "negative"}>{item.changeFromFirst.ats >= 0 ? "+" : ""}{item.changeFromFirst.ats}</span></div>)}</div>}
            <div className="resume-list">
            {resumes.map((resume) => (
              <article className={`resume-card ${resume.isActive ? "active" : ""} ${selectedId === resume.id ? "selected" : ""}`} key={resume.id}>
                <div className="resume-card-heading">
                  <div>
                    <span>{resume.isActive ? "Active resume" : `Version ${resume.version || 1}`}</span>
                    <h2>{resume.originalFileName}</h2>
                    <p>{formatSize(resume.fileSize)} · Uploaded {formatDate(resume.uploadDate)}</p>
                  </div>
                  {resume.latestAnalysis ? <div className="mini-score"><strong>{resume.latestAnalysis.scores.ats}</strong><span>ATS</span></div> : <span className="resume-ready">{resume.extractionStatus}</span>}
                </div>

                <div className="resume-analysis">
                  <div><strong>Skills</strong><p>{resume.summary.skills.slice(0, 6).join(", ") || "Not detected"}</p></div>
                  <div><strong>Technologies</strong><p>{resume.summary.technologies.slice(0, 6).join(", ") || "Not detected"}</p></div>
                  <div><strong>Projects</strong><p>{resume.summary.projects.length}</p></div>
                  <div><strong>Experience entries</strong><p>{resume.summary.experience.length}</p></div>
                </div>

                <div className="resume-actions">
                  <label className="compare-check"><input type="checkbox" checked={compareIds.includes(resume.id)} disabled={!compareIds.includes(resume.id) && compareIds.length >= 4} onChange={() => toggleComparison(resume.id)} /> Compare</label>
                  <button type="button" onClick={() => selectResume(resume.id)}>Review</button>
                  {!resume.isActive && (
                    <button type="button" disabled={busyId === resume.id} onClick={() => handleActivate(resume.id)}>
                      Use for Interviews
                    </button>
                  )}
                  <button className="delete" type="button" disabled={busyId === resume.id} onClick={() => handleDelete(resume)}>
                    {busyId === resume.id ? "Working..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default Resumes;
