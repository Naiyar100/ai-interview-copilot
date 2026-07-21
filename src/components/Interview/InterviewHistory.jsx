import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteInterview, getInterviews } from "../../services/api";
import "./InterviewHistory.css";

function formatDate(dateValue) {
  if (!dateValue) return "Unknown date";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function InterviewHistory() {
  const [interviews, setInterviews] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const loadInterviews = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getInterviews({
        page,
        limit: 6,
        search,
        difficulty,
        status,
        date,
        sortBy: "createdAt",
        sortOrder,
      });
      setInterviews(response.data.interviews);
      setTotalPages(response.data.totalPages);
      setTotalItems(response.data.totalItems);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Unable to load interview history");
    } finally {
      setLoading(false);
    }
  }, [date, difficulty, page, search, sortOrder, status]);

  useEffect(() => {
    const request = window.setTimeout(loadInterviews, 250);
    return () => window.clearTimeout(request);
  }, [loadInterviews]);

  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const handleDelete = async (interview) => {
    const confirmed = window.confirm(
      `Delete the ${interview.role} interview? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(interview.id);
    setError("");

    try {
      await deleteInterview(interview.id);
      if (interviews.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        await loadInterviews();
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to delete interview");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <main className="history-page">
      <div className="history-glow history-glow-one" />
      <div className="history-glow history-glow-two" />

      <div className="history-container">
        <header className="history-header">
          <Link className="history-brand" to="/dashboard">
            <span className="history-logo" aria-hidden="true">AI</span>
            AI Interview Copilot
          </Link>
          <Link className="history-dashboard-link" to="/dashboard">
            Back to Dashboard
          </Link>
        </header>

        <section className="history-content">
          <div className="history-heading">
            <span>Interview history</span>
            <h1>Your Sessions</h1>
            <p>Review, resume, filter, and manage your saved mock interviews.</p>
          </div>

          <div className="history-filters">
            <label>
              Search
              <input
                type="search"
                placeholder="Role or interview type"
                value={search}
                onChange={updateFilter(setSearch)}
              />
            </label>
            <label>
              Difficulty
              <select value={difficulty} onChange={updateFilter(setDifficulty)}>
                <option value="">All</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </label>
            <label>
              Status
              <select value={status} onChange={updateFilter(setStatus)}>
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label>
              Date
              <input type="date" value={date} onChange={updateFilter(setDate)} />
            </label>
            <label>
              Sort
              <select value={sortOrder} onChange={updateFilter(setSortOrder)}>
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </label>
          </div>

          {error && <p className="history-error" role="alert">{error}</p>}
          {!loading && (
            <p className="history-count">
              {totalItems} saved interview{totalItems === 1 ? "" : "s"}
            </p>
          )}

          {loading ? (
            <div className="history-empty"><p>Loading interview history...</p></div>
          ) : interviews.length > 0 ? (
            <div className="history-list">
              {interviews.map((interview) => (
                <article className="history-card" key={interview.id}>
                  <div className="history-card-top">
                    <div>
                      <span className="history-eyebrow">{interview.interviewType}</span>
                      <h2>{interview.role}</h2>
                    </div>
                    <div className="history-card-badges">
                      <span className={`history-status ${interview.status}`}>
                        {interview.status}
                      </span>
                      <span className="history-date">
                        {formatDate(interview.completedAt || interview.createdAt)}
                      </span>
                    </div>
                  </div>

                  <dl className="history-stats">
                    <div><dt>Level</dt><dd>{interview.experienceLevel}</dd></div>
                    <div><dt>Difficulty</dt><dd>{interview.difficulty}</dd></div>
                    <div><dt>Total questions</dt><dd>{interview.totalQuestions}</dd></div>
                    <div><dt>Answered</dt><dd>{interview.answeredQuestions}</dd></div>
                  </dl>

                  <div className="history-card-actions">
                    <Link className="history-detail-button" to={`/interview/results/${interview.id}`}>
                      View Details
                    </Link>
                    {interview.status === "draft" && interview.questions.length > 0 && (
                      <Link className="history-resume-button" to={`/interview/session/${interview.id}`}>
                        Resume
                      </Link>
                    )}
                    <button
                      className="history-delete-button"
                      type="button"
                      disabled={deletingId === interview.id}
                      onClick={() => handleDelete(interview)}
                    >
                      {deletingId === interview.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="history-empty">
              <span className="history-empty-icon" aria-hidden="true">AI</span>
              <h2>No matching interviews</h2>
              <p>Start a new interview or adjust the filters above.</p>
              <Link className="history-start-button" to="/interview/setup">
                Start New Interview
              </Link>
            </div>
          )}

          {totalPages > 1 && (
            <nav className="history-pagination" aria-label="Interview history pages">
              <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}

export default InterviewHistory;
