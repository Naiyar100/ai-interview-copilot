import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getInterviewEvaluations,
  reevaluateInterview,
} from "../services/api";
import "./InterviewReport.css";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function InterviewReport() {
  const { id } = useParams();
  const [interview, setInterview] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationCooldown, setEvaluationCooldown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getInterviewEvaluations(id)
      .then((response) => {
        if (!active) return;
        setInterview(response.data.interview);
        setReports(response.data.evaluations);
        setSelectedId(response.data.evaluations[0]?.id || "");
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load evaluation reports");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!evaluationCooldown) return undefined;
    const timer = window.setTimeout(
      () => setEvaluationCooldown((seconds) => Math.max(seconds - 1, 0)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [evaluationCooldown]);

  const handleReevaluate = async () => {
    if (!window.confirm("Run Gemini evaluation again and keep the current report in history?")) {
      return;
    }
    setEvaluating(true);
    setError("");
    try {
      const response = await reevaluateInterview(id, "keep");
      const nextReport = response.data.evaluation;
      setReports((currentReports) => [nextReport, ...currentReports]);
      setSelectedId(nextReport.id);
    } catch (requestError) {
      setError(requestError.message || "Unable to re-evaluate interview");
      if (requestError.statusCode === 429) setEvaluationCooldown(30);
    } finally {
      setEvaluating(false);
    }
  };

  const report = reports.find((item) => item.id === selectedId) || reports[0];

  if (loading || !interview) {
    return (
      <main className="report-page">
        <div className="report-container">
          <p>{error || "Loading AI interview report..."}</p>
          {error && <Link to={`/interview/results/${id}`}>Back to interview results</Link>}
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="report-page">
        <div className="report-container report-empty">
          <h1>No evaluation report yet</h1>
          <p>Generate an evaluation from the completed interview results page.</p>
          <Link className="report-button" to={`/interview/results/${id}`}>Open Interview Results</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="report-page">
      <div className="report-glow report-glow-one" />
      <div className="report-glow report-glow-two" />
      <div className="report-container">
        <header className="report-header">
          <Link className="report-brand" to="/dashboard"><span>AI</span>AI Interview Copilot</Link>
          <Link to="/interview/history">Interview History</Link>
        </header>

        <section className="report-content">
          <div className="report-heading">
            <div>
              <span>AI evaluation report</span>
              <h1>{interview.role}</h1>
              <p>{interview.experienceLevel} · {interview.difficulty} · {interview.interviewType}</p>
            </div>
            {reports.length > 1 && (
              <label className="report-history-select">
                Previous reports
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  {reports.map((item, index) => (
                    <option value={item.id} key={item.id}>
                      {index === 0 ? "Latest - " : ""}{item.overallScore}% - {formatDate(item.evaluatedAt)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {error && <p className="report-error" role="alert">{error}</p>}

          <div className="report-overview">
            <div className="report-score" style={{ "--score": `${report.overallScore * 3.6}deg` }}>
              <div><strong>{report.overallScore}</strong><span>out of 100</span></div>
            </div>
            <div className="report-summary">
              <span>Overall assessment</span>
              <h2>{report.overallScore >= 80 ? "Strong performance" : report.overallScore >= 60 ? "Good foundation" : "More practice recommended"}</h2>
              <p>{report.summary}</p>
              <small>Evaluated {formatDate(report.evaluatedAt)}</small>
            </div>
          </div>

          <div className="report-highlights">
            <article>
              <span className="positive">Strengths</span>
              <ul>{report.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul>
            </article>
            <article>
              <span className="improve">Improvements</span>
              <ul>{report.improvements.map((improvement) => <li key={improvement}>{improvement}</li>)}</ul>
            </article>
          </div>

          <div className="report-questions">
            <div className="report-section-heading">
              <span>Detailed feedback</span>
              <h2>Question-by-question review</h2>
            </div>
            {report.questions.map((question) => (
              <article className="report-question" key={question.questionId}>
                <div className="report-question-top">
                  <span>Question {question.questionId}</span>
                  <strong>{question.score}/10</strong>
                </div>
                <h3>{question.question}</h3>
                <div className="report-answer"><span>Your answer</span><p>{question.answer}</p></div>
                <div className="report-feedback-grid">
                  <div><span>AI feedback</span><p>{question.feedback}</p></div>
                  <div><span>Ideal answer</span><p>{question.idealAnswer}</p></div>
                </div>
                <div className="report-topics">
                  <span>Topics to study</span>
                  <div>{question.topicsToStudy.length ? question.topicsToStudy.map((topic) => <em key={topic}>{topic}</em>) : <em>No additional topics</em>}</div>
                </div>
              </article>
            ))}
          </div>

          <div className="report-actions">
            <button className="report-button" type="button" disabled={evaluating || evaluationCooldown > 0} onClick={handleReevaluate}>
              {evaluating
                ? "Re-evaluating answers..."
                : evaluationCooldown > 0
                  ? `Try again in ${evaluationCooldown}s`
                  : "Re-evaluate and Keep History"}
            </button>
            <Link className="report-button secondary" to="/dashboard">Back to Dashboard</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default InterviewReport;
