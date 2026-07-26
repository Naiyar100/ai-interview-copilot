import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { submitFeedback } from "../../services/api";

const LIMITS = {
  name: 100,
  email: 254,
  feedback: 2000,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FeedbackForm({ onCancel, onSuccess }) {
  const { user } = useAuth();
  const [values, setValues] = useState({
    name: user?.name || "",
    email: user?.email || "",
    feedback: "",
  });
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!values.name.trim()) nextErrors.name = "Enter your name.";
    if (!EMAIL_PATTERN.test(values.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!values.feedback.trim()) nextErrors.feedback = "Enter your feedback.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setRequestError("");
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      await submitFeedback({
        name: values.name.trim(),
        email: values.email.trim(),
        feedback: values.feedback.trim(),
      });
      onSuccess();
    } catch {
      setRequestError(
        "Your feedback could not be submitted right now. Please try again later.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="feedback-form" onSubmit={handleSubmit} noValidate>
      <label className="feedback-field" htmlFor="feedback-name">
        <span>Name <b aria-hidden="true">*</b></span>
        <input
          id="feedback-name"
          type="text"
          autoComplete="name"
          maxLength={LIMITS.name}
          value={values.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "feedback-name-error" : undefined}
          onChange={(event) => update("name", event.target.value)}
        />
        {errors.name && (
          <p className="feedback-field-error" id="feedback-name-error">{errors.name}</p>
        )}
      </label>

      <label className="feedback-field" htmlFor="feedback-email">
        <span>Email <b aria-hidden="true">*</b></span>
        <input
          id="feedback-email"
          type="email"
          autoComplete="email"
          maxLength={LIMITS.email}
          value={values.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "feedback-email-error" : undefined}
          onChange={(event) => update("email", event.target.value)}
        />
        {errors.email && (
          <p className="feedback-field-error" id="feedback-email-error">{errors.email}</p>
        )}
      </label>

      <label className="feedback-field" htmlFor="feedback-message">
        <span>Feedback <b aria-hidden="true">*</b></span>
        <textarea
          id="feedback-message"
          rows="6"
          maxLength={LIMITS.feedback}
          value={values.feedback}
          aria-invalid={Boolean(errors.feedback)}
          aria-describedby={
            errors.feedback ? "feedback-message-error" : "feedback-message-limit"
          }
          onChange={(event) => update("feedback", event.target.value)}
        />
        <small id="feedback-message-limit">
          {values.feedback.length}/{LIMITS.feedback}
        </small>
        {errors.feedback && (
          <p className="feedback-field-error" id="feedback-message-error">
            {errors.feedback}
          </p>
        )}
      </label>

      {requestError && (
        <p className="feedback-request-error" role="alert">{requestError}</p>
      )}

      <div className="feedback-actions">
        <button
          type="button"
          className="feedback-secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button type="submit" className="feedback-primary" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit feedback"}
        </button>
      </div>
    </form>
  );
}

export default FeedbackForm;
