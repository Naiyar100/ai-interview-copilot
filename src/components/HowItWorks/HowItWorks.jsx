import "./HowItWorks.css";

const steps = [
  {
    icon: "📄",
    title: "Upload Resume",
    description: "Upload your resume or skip this step.",
  },
  {
    icon: "🤖",
    title: "AI Generates Questions",
    description: "Receive role-specific interview questions.",
  },
  {
    icon: "💬",
    title: "Answer Questions",
    description: "Practice by typing your answers.",
  },
  {
    icon: "📊",
    title: "Get Feedback",
    description: "Receive AI-powered insights and improvement tips.",
  },
];

function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="how-it-works-inner">
        <div className="how-heading">
          <span className="how-label">Simple by design</span>
          <h2>How It Works</h2>
          <p>Get interview-ready in just four simple steps.</p>
        </div>

        <div className="steps-list">
          {steps.map((step, index) => (
            <article className="step-card" key={step.title}>
              <div className="step-marker" aria-label={`Step ${index + 1}`}>
                {index + 1}
              </div>

              <div className="step-icon" aria-hidden="true">
                {step.icon}
              </div>

              <span className="step-label">Step {index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;