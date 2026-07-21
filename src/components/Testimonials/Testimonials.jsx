import "./Testimonials.css";

const testimonials = [
  {
    initials: "AS",
    name: "Aman Sharma",
    role: "Frontend Developer",
    quote:
      "The AI-generated questions felt incredibly close to real frontend interviews. It boosted my confidence before my placement drive.",
  },
  {
    initials: "PV",
    name: "Priya Verma",
    role: "Full Stack Developer",
    quote:
      "The resume-based questions helped me explain my projects much more confidently. The experience was smooth and engaging.",
  },
  {
    initials: "RS",
    name: "Rahul Singh",
    role: "Backend Developer",
    quote:
      "The personalized feedback highlighted areas I had never considered. Great tool for interview preparation.",
  },
];

function Testimonials() {
  return (
    <section className="testimonials" id="testimonials">
      <div className="testimonials-inner">
        <div className="testimonials-heading">
          <span className="testimonials-label">Developer stories</span>
          <h2>What Developers Say</h2>
          <p>Sample testimonials demonstrating the user experience.</p>
        </div>

        <div className="testimonials-grid">
          {testimonials.map((testimonial) => (
            <article className="testimonial-card" key={testimonial.name}>
              <div className="testimonial-author">
                <div className="testimonial-avatar" aria-hidden="true">
                  {testimonial.initials}
                </div>

                <div>
                  <h3>{testimonial.name}</h3>
                  <p>{testimonial.role}</p>
                </div>
              </div>

              <div className="testimonial-stars" aria-label="5 out of 5 stars">
                <span aria-hidden="true">★★★★★</span>
              </div>

              <blockquote>“{testimonial.quote}”</blockquote>
            </article>
          ))}
        </div>

        <p className="testimonials-disclaimer">
          * Testimonials shown are sample content for demonstration purposes.
        </p>
      </div>
    </section>
  );
}

export default Testimonials;