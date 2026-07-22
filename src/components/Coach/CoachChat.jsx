import { useEffect, useMemo, useRef, useState } from "react";
import MarkdownMessage from "./MarkdownMessage";

const suggestions = [
  "What should I practice next based on my interview results?",
  "Create a 30-day plan for my target role.",
  "How can I improve my resume for the roles I practice?",
  "Explain my strongest and weakest interview topics.",
];

function CoachMessage({ message, isLast, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  return <article className={`coach-message ${message.role}`}>
    <div className="message-avatar" aria-hidden="true">{message.role === "assistant" ? "AI" : "You"}</div>
    <div className="message-content"><span className="message-author">{message.role === "assistant" ? "Career Coach" : "You"}</span>{message.streaming && !message.content ? <div className="typing-indicator" role="status" aria-label="Career Coach is typing"><i /><i /><i /></div> : message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <p>{message.content}</p>}
      {message.role === "assistant" && !message.streaming && <div className="message-actions"><button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>{isLast && <button type="button" onClick={onRegenerate}>Regenerate</button>}</div>}
    </div>
  </article>;
}

export default function CoachChat({ chat, streaming, error, onSend, onStop, onRegenerate }) {
  const [message, setMessage] = useState(""); const endRef = useRef(null);
  const messages = useMemo(() => chat?.messages || [], [chat?.messages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);
  const submit = (event) => { event.preventDefault(); if (!message.trim() || streaming) return; const value = message; setMessage(""); onSend(value); };
  return <section className="coach-chat" aria-label="Career coach chat">
    <div className="coach-chat-body">
      {!messages.length ? <div className="coach-welcome"><span>AI</span><h1>Your personal AI Career Coach</h1><p>Ask for evidence-based guidance using your resume, interview history, evaluations, and analytics. Missing data will never be invented.</p><div className="prompt-suggestions">{suggestions.map((prompt) => <button type="button" key={prompt} onClick={() => setMessage(prompt)}>{prompt}<span>→</span></button>)}</div></div>
        : <div className="coach-messages">{messages.map((item, index) => <CoachMessage message={item} isLast={index === messages.length - 1} onRegenerate={onRegenerate} key={item.id || `${item.role}-${index}`} />)}<div ref={endRef} /></div>}
    </div>
    <div className="coach-composer-wrap">{error && <div className="coach-error" role="alert">{error}</div>}<form className="coach-composer" onSubmit={submit}><label><span className="sr-only">Message Career Coach</span><textarea aria-label="Message Career Coach" rows="1" maxLength="4000" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) submit(event); }} placeholder="Ask about your career, interviews, resume, or next steps…" /></label>{streaming ? <button type="button" className="stop" onClick={onStop} aria-label="Stop response">■</button> : <button type="submit" disabled={!message.trim()} aria-label="Send message">↑</button>}</form><small>AI can make mistakes. Personalized claims use only your saved practice data.</small></div>
  </section>;
}
