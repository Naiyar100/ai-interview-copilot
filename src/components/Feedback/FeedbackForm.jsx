import { useState } from "react";
import { submitFeedback } from "../../services/api";
import RatingInput from "./RatingInput";

const LIMITS = {
  liked: 1000,
  improvements: 1000,
  bugDescription: 1000,
  pageOrFeature: 120,
};

const initialValues = {
  rating: 0,
  liked: "",
  improvements: "",
  foundBug: false,
  bugDescription: "",
  pageOrFeature: "",
};

function FeedbackForm({ onCancel, onSuccess }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!values.rating) nextErrors.rating = "Choose a rating from 1 to 5.";
    if (!values.liked.trim()) nextErrors.liked = "Tell us what you liked.";
    if (!values.improvements.trim()) {
      nextErrors.improvements = "Tell us what could be improved.";
    }
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
        ...values,
        liked: values.liked.trim(),
        improvements: values.improvements.trim(),
        bugDescription: values.bugDescription.trim(),
        pageOrFeature: values.pageOrFeature.trim(),
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

  const textField = ({ field, label, required = false, rows = 3 }) => (
    <label className="feedback-field" htmlFor={`feedback-${field}`}>
      <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
      <textarea
        id={`feedback-${field}`}
        rows={rows}
        maxLength={LIMITS[field]}
        value={values[field]}
        aria-invalid={Boolean(errors[field])}
        aria-describedby={errors[field] ? `${field}-error` : `${field}-limit`}
        onChange={(event) => update(field, event.target.value)}
      />
      <small id={`${field}-limit`}>{values[field].length}/{LIMITS[field]}</small>
      {errors[field] && (
        <p className="feedback-field-error" id={`${field}-error`}>{errors[field]}</p>
      )}
    </label>
  );

  return (
    <form className="feedback-form" onSubmit={handleSubmit} noValidate>
      <RatingInput
        value={values.rating}
        onChange={(rating) => update("rating", rating)}
        error={errors.rating}
      />
      {textField({ field: "liked", label: "What did you like?", required: true })}
      {textField({
        field: "improvements",
        label: "What should be improved?",
        required: true,
      })}

      <fieldset className="feedback-bug">
        <legend>Did you find a bug?</legend>
        <label>
          <input
            type="radio"
            name="foundBug"
            checked={!values.foundBug}
            onChange={() => update("foundBug", false)}
          />
          No
        </label>
        <label>
          <input
            type="radio"
            name="foundBug"
            checked={values.foundBug}
            onChange={() => update("foundBug", true)}
          />
          Yes
        </label>
      </fieldset>

      {values.foundBug &&
        textField({ field: "bugDescription", label: "Bug description (optional)" })}

      <label className="feedback-field" htmlFor="feedback-pageOrFeature">
        <span>Page or feature (optional)</span>
        <input
          id="feedback-pageOrFeature"
          type="text"
          maxLength={LIMITS.pageOrFeature}
          value={values.pageOrFeature}
          onChange={(event) => update("pageOrFeature", event.target.value)}
        />
        <small>{values.pageOrFeature.length}/{LIMITS.pageOrFeature}</small>
      </label>

      {requestError && <p className="feedback-request-error" role="alert">{requestError}</p>}

      <div className="feedback-actions">
        <button type="button" className="feedback-secondary" onClick={onCancel} disabled={submitting}>
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
