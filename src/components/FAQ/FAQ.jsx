import { useState } from "react";
import "./FAQ.css";

const faqItems = [
  {
    question: "Is this project free to use?",
    answer: "Yes, the core version uses free tools and APIs.",
  },
  {
    question: "Can I upload my resume?",
    answer: "Yes, resume upload will be added in the MVP.",
  },
  {
    question: "Does it give AI feedback?",
    answer: "Yes, AI feedback will be part of the advanced version.",
  },
  {
    question: "Is this useful for frontend interviews?",
    answer:
      "Yes, users can choose Frontend, Backend, or Full Stack roles.",
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  function toggleQuestion(index) {
    setOpenIndex((currentIndex) => (currentIndex === index ? null : index));
  }

  return (
    <section className="faq" id="faq">
      <div className="faq-heading">
        <span className="faq-label">Questions, answered</span>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know before starting your first interview.</p>
      </div>

      <div className="faq-list">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index;
          const answerId = `faq-answer-${index}`;

          return (
            <article className={`faq-item ${isOpen ? "open" : ""}`} key={item.question}>
              <h3>
                <button
                  className="faq-question"
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => toggleQuestion(index)}
                >
                  <span>{item.question}</span>
                  <span className="faq-toggle" aria-hidden="true">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
              </h3>

              <div className="faq-answer" id={answerId} hidden={!isOpen}>
                <p>{item.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default FAQ;