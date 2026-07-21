import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  evaluateInterview,
  getInterview,
  regenerateInterviewQuestions,
} from "../../services/api";
import "./InterviewResults.css";

const formatDuration = (duration) => {
  if (duration === null || duration === undefined) return "Not completed";
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}m ${seconds}s`;
};

function InterviewResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationCooldown, setEvaluationCooldown] = useState(0);

  useEffect(() => {
    let active = true;

    getInterview(id)
      .then((response) => {
        if (active) setInterview(response.data.interview);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load interview");
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

  const handleRegenerate = async () => {
    const hasAnswers = interview.answers.some((answer) => answer?.trim());
    const confirmed = !hasAnswers || window.confirm(
      "Regenerating will replace the questions and remove your saved answers. Continue?",
    );
    if (!confirmed) return;

    setRegenerating(true);
    setError("");
    try {
      const response = await regenerateInterviewQuestions(id, hasAnswers);
      setInterview(response.data.interview);
    } catch (requestError) {
      setError(requestError.message || "Unable to regenerate questions");
    } finally {
      setRegenerating(false);
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    setError("");
    try {
      await evaluateInterview(id);
      navigate(`/interview/report/${id}`);
    } catch (requestError) {
      setError(requestError.message || "Unable to evaluate interview");
      if (requestError.statusCode === 429) setEvaluationCooldown(30);
      setEvaluating(false);
    }
  };

  if (loading || !interview) {
    return (
      <main className="results-page">
        <div className="results-container">
          <section className="results-content">
            <p>{error || "Loading interview details..."}</p>
            {error && <Link to="/interview/history">Back to history</Link>}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="results-page">
      <div className="results-glow results-glow-one" />
      <div className="results-glow results-glow-two" />

      <div className="results-container">
        <header className="results-header">
          <Link className="results-brand" to="/dashboard">
            <span className="results-logo" aria-hidden="true">AI</span>
            AI Interview Copilot
          </Link>
          <Link className="results-dashboard-link" to="/interview/history">
            Interview History
          </Link>
        </header>

        <section className="results-content">
          <div className="results-heading">
            <span>Interview review</span>
            <h1>{interview.status === "completed" ? "Your Interview Results" : "Draft Interview"}</h1>
            <p>Review the configuration and answers stored for this interview.</p>
          </div>

          <div className="results-summary-card">
            <div>
              <span className="results-eyebrow">{interview.interviewType}</span>
              <h2>{interview.role}</h2>
            </div>

            <dl className="results-config">
              <div><dt>Level</dt><dd>{interview.experienceLevel}</dd></div>
              <div><dt>Difficulty</dt><dd>{interview.difficulty}</dd></div>
              <div><dt>Answered</dt><dd>{interview.answeredQuestions} / {interview.totalQuestions}</dd></div>
              <div><dt>Duration</dt><dd>{formatDuration(interview.duration)}</dd></div>
            </dl>
          </div>

          <div className="answers-list">
            {interview.questions.map((question, index) => (
              <article className="answer-card" key={`${interview.id}-${index}`}>
                <div className="answer-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="answer-content">
                  <span>Question</span>
                  <h3>{question}</h3>
                  <p className={interview.answers[index]?.trim() ? "" : "empty-answer"}>
                    {interview.answers[index]?.trim() || "No answer written for this question."}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {error && <p className="results-error" role="alert">{error}</p>}

          <div className="results-actions">
            {interview.status === "draft" ? (
              <>
                {interview.questions.length > 0 && (
                  <Link className="results-button" to={`/interview/session/${interview.id}`}>
                    Resume Interview
                  </Link>
                )}
                <button
                  className="results-button"
                  type="button"
                  disabled={regenerating}
                  onClick={handleRegenerate}
                >
                  {regenerating
                    ? "Generating questions..."
                    : interview.questions.length > 0
                      ? "Regenerate Questions"
                      : "Generate Questions"}
                </button>
              </>
            ) : (
              <>
                {interview.evaluationCount > 0 ? (
                  <Link className="results-button" to={`/interview/report/${interview.id}`}>
                    View AI Report
                  </Link>
                ) : (
                  <button
                    className="results-button"
                    type="button"
                    disabled={evaluating || evaluationCooldown > 0}
                    onClick={handleEvaluate}
                  >
                    {evaluating
                      ? "Evaluating your answers..."
                      : evaluationCooldown > 0
                        ? `Try again in ${evaluationCooldown}s`
                        : "Generate AI Evaluation"}
                  </button>
                )}
                <Link className="results-button results-button-secondary" to="/dashboard">
                  Back to Dashboard
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default InterviewResults;
