function RatingInput({ value, onChange, error }) {
  return (
    <fieldset className="feedback-rating" aria-describedby={error ? "rating-error" : undefined}>
      <legend>Overall rating <span aria-hidden="true">*</span></legend>
      <div className="rating-options">
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating}>
            <input
              type="radio"
              name="rating"
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
            />
            <span aria-hidden="true">★</span>
            <span className="sr-only">{rating} out of 5</span>
          </label>
        ))}
      </div>
      {error && <p className="feedback-field-error" id="rating-error">{error}</p>}
    </fieldset>
  );
}

export default RatingInput;
