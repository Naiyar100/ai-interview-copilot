import "./Testimonials.css";

const practiceBenefits = [
  {
    initials: "01",
    name: "Role-aware practice",
    role: "Questions",
    quote: "Generate questions from your selected role, experience, difficulty, interview type, and active resume.",
  },
  {
    initials: "02",
    name: "Actionable feedback",
    role: "Evaluation",
    quote: "Review structured scores, strengths, improvements, ideal answers, and recommended study topics.",
  },
  {
    initials: "03",
    name: "Visible progress",
    role: "Analytics",
    quote: "Track owned interview history, topic trends, activity, streaks, rewards, and readiness over time.",
  },
];

function Testimonials() {
  return (
    <section className="testimonials" id="testimonials">
      <div className="testimonials-inner">
        <div className="testimonials-heading">
          <span className="testimonials-label">Designed for deliberate practice</span>
          <h2>Turn every session into progress</h2>
          <p>Move from tailored questions to specific feedback and measurable improvement.</p>
        </div>

        <div className="testimonials-grid">
          {practiceBenefits.map((benefit) => (
            <article className="testimonial-card" key={benefit.name}>
              <div className="testimonial-author">
                <div className="testimonial-avatar" aria-hidden="true">
                  {benefit.initials}
                </div>

                <div>
                  <h3>{benefit.name}</h3>
                  <p>{benefit.role}</p>
                </div>
              </div>

              <blockquote>{benefit.quote}</blockquote>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}

export default Testimonials;
