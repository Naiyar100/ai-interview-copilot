import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteResume,
  getResumes,
  setActiveResume,
  uploadResume,
} from "../services/api";
import "./Resumes.css";

const formatSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(Math.round(bytes / 1024), 1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));

function Resumes() {
  const fileInput = useRef(null);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const loadResumes = useCallback(async () => {
    try {
      const response = await getResumes();
      setResumes(response.data.resumes);
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

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError("");
    setStatus("");
    try {
      await uploadResume(file, setProgress);
      setStatus("Resume uploaded, analyzed, and selected for future interviews.");
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
      setStatus("Resume deleted.");
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
        </div>

        <span className="resume-eyebrow">Resume Library</span>
        <h1>Manage your resumes</h1>
        <p className="resume-description">
          Your active resume personalizes new interview questions. PDFs remain private
          and are never exposed as public files.
        </p>

        <label className={`resume-upload ${uploading ? "uploading" : ""}`}>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            onChange={handleUpload}
          />
          <strong>{uploading ? "Extracting and analyzing resume..." : "Upload PDF Resume"}</strong>
          <span>PDF only, maximum 5 MB. A new upload becomes active automatically.</span>
          {uploading && (
            <div className="resume-progress" aria-label={`Upload ${progress}% complete`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
        </label>

        {error && <p className="resume-error" role="alert">{error}</p>}
        {status && <p className="resume-success">{status}</p>}

        {loading ? (
          <div className="resume-empty">Loading resumes...</div>
        ) : resumes.length === 0 ? (
          <div className="resume-empty">
            <h2>No resumes uploaded</h2>
            <p>Your interviews will use role and difficulty preferences until you upload one.</p>
          </div>
        ) : (
          <div className="resume-list">
            {resumes.map((resume) => (
              <article className={`resume-card ${resume.isActive ? "active" : ""}`} key={resume.id}>
                <div className="resume-card-heading">
                  <div>
                    <span>{resume.isActive ? "Active resume" : "Saved resume"}</span>
                    <h2>{resume.originalFileName}</h2>
                    <p>{formatSize(resume.fileSize)} · Uploaded {formatDate(resume.uploadDate)}</p>
                  </div>
                  <span className="resume-ready">{resume.extractionStatus}</span>
                </div>

                <div className="resume-analysis">
                  <div><strong>Skills</strong><p>{resume.summary.skills.slice(0, 6).join(", ") || "Not detected"}</p></div>
                  <div><strong>Technologies</strong><p>{resume.summary.technologies.slice(0, 6).join(", ") || "Not detected"}</p></div>
                  <div><strong>Projects</strong><p>{resume.summary.projects.length}</p></div>
                  <div><strong>Experience entries</strong><p>{resume.summary.experience.length}</p></div>
                </div>

                <div className="resume-actions">
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
        )}
      </section>
    </main>
  );
}

export default Resumes;
