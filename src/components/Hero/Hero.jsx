import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Hero.css";

function Hero() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const firstLine = "PRACTICE SMARTER.";
  const secondLine = "INTERVIEW BETTER.";
  return (
    <section className="hero" id="home">
      <div className="hero-content">
        <div className="hero-badge">Your personal interview coach</div>

        <h1 className="hero-heading">
          <span className="animated-line">
            {firstLine.split("").map((letter, index) => (
              <span
                className="shake-letter"
                style={{ "--i": index }}
                key={index}
              >
                {letter === " " ? "\u00A0" : letter}
              </span>
            ))}
          </span>

          <br />

          <span className="animated-line gradient-line">
            {secondLine.split("").map((letter, index) => (
              <span
                className="shake-letter"
                style={{ "--i": index }}
                key={index}
              >
                {letter === " " ? "\u00A0" : letter}
              </span>
            ))}
          </span>
        </h1>

        <p className="hero-description">
          AI-powered mock interviews for developers. Sharpen your skills, get
          instant feedback, and walk into your next interview with confidence.
        </p>

        <button
          className="hero-button"
          type="button"
          onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
        >
          Start Interview
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="hero-visual" aria-hidden="true">
        <div className="hero-glow" />

        <div className="interview-card">
          <div className="card-header">
            <div className="card-title">
              <span className="card-ai-icon">AI</span>
              Technical Interview
            </div>
            <span className="live-badge">Live</span>
          </div>

          <div className="code-window">
            <div className="window-controls">
              <span />
              <span />
              <span />
            </div>
            <pre>
              <code>{`function findPair(nums, target) {
  const seen = new Map();

  for (const num of nums) {
    // Your solution...
  }
}`}</code>
            </pre>
          </div>

          <div className="feedback-card">
            <span className="feedback-icon">✓</span>
            <span>
              <strong>Great approach!</strong>
              Your explanation is clear and efficient.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
