import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Modal from "../Modal/Modal";
import FeedbackForm from "./FeedbackForm";
import "./WelcomeFeedbackModal.css";

const publicRoutes = new Set(["/", "/login", "/signup"]);

function WelcomeFeedbackModal() {
  const location = useLocation();
  const {
    isAuthenticated,
    welcomeRequestId,
    dismissWelcome,
  } = useAuth();
  const [view, setView] = useState("welcome");
  const [manualFeedbackOpen, setManualFeedbackOpen] = useState(false);

  const isAuthenticatedArea =
    isAuthenticated && !publicRoutes.has(location.pathname);
  const welcomeOpen = isAuthenticatedArea && Boolean(welcomeRequestId);
  const modalOpen = welcomeOpen || (isAuthenticatedArea && manualFeedbackOpen);

  const close = useCallback(() => {
    if (welcomeRequestId) dismissWelcome();
    setManualFeedbackOpen(false);
    setView("welcome");
  }, [dismissWelcome, welcomeRequestId]);

  const openPermanentFeedback = () => {
    setView("feedback");
    setManualFeedbackOpen(true);
  };

  return (
    <>
      {isAuthenticatedArea && !modalOpen && (
        <button
          type="button"
          className="persistent-feedback-button"
          onClick={openPermanentFeedback}
          aria-label="Give feedback about AI Interview Copilot"
        >
          <span aria-hidden="true">✦</span>
          Give Feedback
        </button>
      )}

      {modalOpen && (
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
                  Please explore the application and test its features. If you
                  find anything broken, confusing, slow, or something that could
                  be improved, please share your feedback with me.
                </p>
                <p>
                  Your feedback will help me improve the project. Thank you for
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
                Tell me what worked well or what could make your experience better.
              </p>
              <FeedbackForm
                onCancel={welcomeOpen ? () => setView("welcome") : close}
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
      )}
    </>
  );
}

export default WelcomeFeedbackModal;
