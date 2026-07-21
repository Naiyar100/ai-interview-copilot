import { useState } from "react";
import { Link } from "react-router-dom";
import "./AccountPages.css";

const PREFERENCES_KEY = "interviewPreferences";

function getSavedPreferences() {
  try {
    const savedPreferences = localStorage.getItem(PREFERENCES_KEY);
    return savedPreferences ? JSON.parse(savedPreferences) : {};
  } catch {
    return {};
  }
}

function Preferences() {
  const savedPreferences = getSavedPreferences();
  const [preferredRole, setPreferredRole] = useState(
    savedPreferences.preferredRole || "Frontend Developer",
  );
  const [difficulty, setDifficulty] = useState(
    savedPreferences.difficulty || "Medium",
  );
  const [questions, setQuestions] = useState(savedPreferences.questions || "5");
  const [status, setStatus] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        preferredRole,
        difficulty,
        questions,
      }),
    );
    setStatus("Preferences saved.");
  };

  return (
    <main className="account-page">
      <section className="account-card">
        <div className="account-topbar">
          <Link to="/profile">← Back to Profile</Link>
        </div>

        <span className="account-eyebrow">Preferences</span>
        <h1>Interview Preferences</h1>
        <p className="account-description">
          Set your default role, difficulty, and question count for practice.
        </p>

        <form className="account-form" onSubmit={handleSubmit}>
          <label>
            Preferred Interview Role
            <select
              value={preferredRole}
              onChange={(event) => setPreferredRole(event.target.value)}
            >
              <option>Frontend Developer</option>
              <option>Backend Developer</option>
              <option>Full Stack Developer</option>
            </select>
          </label>

          <label>
            Difficulty Preference
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </label>

          <label>
            Default Questions
            <select value={questions} onChange={(event) => setQuestions(event.target.value)}>
              <option>5</option>
              <option>10</option>
              <option>15</option>
            </select>
          </label>

          {status && <p className="account-success">{status}</p>}

          <button type="submit">Save Preferences</button>
        </form>
      </section>
    </main>
  );
}

export default Preferences;
