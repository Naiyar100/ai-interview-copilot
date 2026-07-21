import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createInterview,
  generateInterviewQuestions,
  getResumes,
} from "../../services/api";
import "./InterviewSetupForm.css";

const setupOptions = {
  role: ["Frontend Developer", "Backend Developer", "Full Stack Developer"],
  experience: ["Fresher", "1–2 Years", "3–5 Years"],
  questions: ["5", "10", "15"],
  difficulty: ["Easy", "Medium", "Hard"],
  interviewType: ["Technical", "Behavioral", "Mixed"],
};

function OptionGroup({ legend, icon, name, options, value, onChange }) {
  return (
    <fieldset className="setup-group">
      <legend>
        <span aria-hidden="true">{icon}</span>
        {legend}
      </legend>

      <div className="setup-options">
        {options.map((option) => (
          <label
            className={`setup-option ${value === option ? "selected" : ""}`}
            key={option}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={(event) => onChange(event.target.value)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function InterviewSetupForm() {
  const navigate = useNavigate();
  const [role, setRole] = useState("Frontend Developer");
  const [experience, setExperience] = useState("Fresher");
  const [questions, setQuestions] = useState("5");
  const [difficulty, setDifficulty] = useState("Medium");
  const [interviewType, setInterviewType] = useState("Technical");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingInterviewId, setPendingInterviewId] = useState("");
  const [activeResume, setActiveResume] = useState(null);

  useEffect(() => {
    let active = true;
    getResumes()
      .then((response) => {
        if (active) {
          setActiveResume(response.data.resumes.find((resume) => resume.isActive) || null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const generateAndOpenInterview = async (interviewId) => {
    setLoading(true);
    setLoadingMessage("Generating your tailored AI questions...");
    setError("");

    try {
      await generateInterviewQuestions(interviewId);
      navigate(`/interview/session/${interviewId}`);
    } catch (requestError) {
      setPendingInterviewId(interviewId);
      setError(requestError.errors?.[0] || requestError.message);
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setLoadingMessage("Creating your interview...");
    setError("");

    try {
      const response = await createInterview({
        role,
        experienceLevel: experience,
        difficulty,
        interviewType,
        questionCount: Number(questions),
      });
      await generateAndOpenInterview(response.data.interview.id);
    } catch (requestError) {
      setError(requestError.errors?.[0] || requestError.message);
      setLoading(false);
    }
  };

  return (
    <main className="setup-page">
      <div className="setup-glow setup-glow-one" />
      <div className="setup-glow setup-glow-two" />

      <div className="setup-container">
        <header className="setup-header">
          <Link className="setup-brand" to="/">
            <span className="setup-logo" aria-hidden="true">AI</span>
            AI Interview Copilot
          </Link>
          <Link className="back-dashboard" to="/dashboard">← Dashboard</Link>
        </header>

        <section className="setup-content" aria-labelledby="setup-title">
          <div className="setup-heading">
            <span>Personalize your practice</span>
            <h1 id="setup-title">Set up your interview</h1>
            <p>
              Choose your preferences and we&apos;ll prepare an interview tailored
              to your goals.
            </p>
          </div>

          <form className="setup-form" onSubmit={handleSubmit}>
            <div className="setup-resume-context">
              <div>
                <strong>{activeResume ? "Resume-aware interview enabled" : "Standard interview"}</strong>
                <span>
                  {activeResume
                    ? `${activeResume.originalFileName} will personalize the generated questions.`
                    : "Upload a resume to personalize questions around your projects and skills."}
                </span>
              </div>
              <Link to="/resumes">{activeResume ? "Change resume" : "Upload resume"}</Link>
            </div>
            <OptionGroup
              legend="Select Role"
              icon="💼"
              name="role"
              options={setupOptions.role}
              value={role}
              onChange={setRole}
            />
            <OptionGroup
              legend="Experience Level"
              icon="📈"
              name="experience"
              options={setupOptions.experience}
              value={experience}
              onChange={setExperience}
            />
            <OptionGroup
              legend="Number of Questions"
              icon="💬"
              name="questions"
              options={setupOptions.questions}
              value={questions}
              onChange={setQuestions}
            />
            <OptionGroup
              legend="Difficulty"
              icon="🎯"
              name="difficulty"
              options={setupOptions.difficulty}
              value={difficulty}
              onChange={setDifficulty}
            />

            <OptionGroup
              legend="Interview Type"
              icon="Type"
              name="interviewType"
              options={setupOptions.interviewType}
              value={interviewType}
              onChange={setInterviewType}
            />

            {error && <p className="setup-error" role="alert">{error}</p>}

            {pendingInterviewId && !loading && (
              <button
                className="start-interview-button"
                type="button"
                onClick={() => generateAndOpenInterview(pendingInterviewId)}
              >
                Retry Question Generation
              </button>
            )}

            {!pendingInterviewId && (
              <button className="start-interview-button" type="submit" disabled={loading}>
                {loading ? loadingMessage : "Start Interview"}
                <span aria-hidden="true">→</span>
              </button>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}

export default InterviewSetupForm;
