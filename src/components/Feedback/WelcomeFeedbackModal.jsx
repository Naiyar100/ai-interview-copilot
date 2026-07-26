import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Modal from "../Modal/Modal";
import FeedbackForm from "./FeedbackForm";
import "./WelcomeFeedbackModal.css";

export const WELCOME_DISMISSED_KEY =
  "ai-interview-copilot-welcome-v2-dismissed";

const publicRoutes = new Set(["/", "/login", "/signup"]);

function WelcomeFeedbackModal() {
  const location = useLocation();
  const {
    isAuthenticated,
    welcomeRequestId,
    dismissWelcome,
  } = useAuth();
  const [view, setView] = useState("welcome");

  const dismissed =
    typeof localStorage !== "undefined" &&
    localStorage.getItem(WELCOME_DISMISSED_KEY) === "true";
  const shouldShow =
    isAuthenticated &&
    welcomeRequestId &&
    !dismissed &&
    !publicRoutes.has(location.pathname);

  const close = useCallback(() => {
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    setView("welcome");
    dismissWelcome();
  }, [dismissWelcome]);

  if (!shouldShow) return null;

  return (
    <Modal
      titleId="welcome-feedback-title"
      descriptionId="welcome-feedback-description"
      onClose={close}
      className="welcome-feedback-modal"
    >
      {view === "welcome" && (
        <>
          <div className="welcome-icon" aria-hidden="true">AI</div>
          <p className="welcome-kicker">A note from the creator</p>
          <h2 id="welcome-feedback-title">Welcome to AI Interview Copilot 👋</h2>
          <div id="welcome-feedback-description" className="welcome-copy">
            <p>
              Hey! I&apos;m <strong className="creator-name">Naiyar Alam</strong>,
              the creator of AI Interview Copilot.
            </p>
            <p>
              I&apos;d really appreciate it if you could explore the application
              and test its features. If you notice anything that is broken,
              confusing, slow, or could be improved, please share your feedback
              with me.
            </p>
            <p>
              Your feedback will help me make the project better. Thank you for
              trying it! 🙌
            </p>
          </div>
          <div className="welcome-actions">
            <button type="button" className="feedback-primary" onClick={close}>
              Explore the App
            </button>
            <button
              type="button"
              className="feedback-secondary"
              onClick={() => setView("feedback")}
            >
              Give Feedback
            </button>
          </div>
        </>
      )}

      {view === "feedback" && (
        <>
          <p className="welcome-kicker">Help shape the experience</p>
          <h2 id="welcome-feedback-title">Share your feedback</h2>
          <p id="welcome-feedback-description" className="feedback-intro">
            A few details will help identify what works and what needs attention.
          </p>
          <FeedbackForm
            onCancel={() => setView("welcome")}
            onSuccess={() => setView("success")}
          />
        </>
      )}

      {view === "success" && (
        <div className="feedback-success" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>
          <h2 id="welcome-feedback-title">Thank you!</h2>
          <p id="welcome-feedback-description">
            Your feedback was submitted successfully and will help improve the app.
          </p>
          <button type="button" className="feedback-primary" onClick={close}>
            Continue exploring
          </button>
        </div>
      )}
    </Modal>
  );
}

export default WelcomeFeedbackModal;
