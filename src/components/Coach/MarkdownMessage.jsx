import { Fragment, useState } from "react";

const inlinePattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*]+\*)/g;

const renderInline = (text) => text.split(inlinePattern).filter(Boolean).map((part, index) => {
  if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
  if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
  const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
  if (link) return <a href={link[2]} target="_blank" rel="noreferrer" key={index}>{link[1]}</a>;
  if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
  return <Fragment key={index}>{part}</Fragment>;
});

const codePattern = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|try|catch|throw|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/g;
const highlightCode = (code) => code.split(codePattern).filter((part) => part !== "").map((part, index) => {
  const kind = /^(\/\/|#|\/\*)/.test(part) ? "comment" : /^["'`]/.test(part) ? "string" : /^\d/.test(part) ? "number" : /^(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|try|catch|throw|true|false|null|undefined)$/.test(part) ? "keyword" : "plain";
  return <span className={`code-${kind}`} key={index}>{part}</span>;
});

function CodeBlock({ block }) {
  const [copied, setCopied] = useState(false);
  const match = block.match(/^```([^\n]*)\n?([\s\S]*?)```$/);
  const language = match?.[1]?.trim() || "text";
  const code = match?.[2]?.replace(/\n$/, "") || block;
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  return <div className="coach-code"><div><span>{language}</span><button type="button" onClick={copy}>{copied ? "Copied" : "Copy code"}</button></div><pre><code>{highlightCode(code)}</code></pre></div>;
}

const renderTextBlocks = (text, keyPrefix) => {
  const lines = text.split("\n"); const output = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { const Tag = `h${heading[1].length + 2}`; output.push(<Tag key={`${keyPrefix}-${index}`}>{renderInline(heading[2])}</Tag>); index += 1; continue; }
    if (/^[-*]\s+/.test(line)) {
      const items = []; while (index < lines.length && /^[-*]\s+/.test(lines[index])) { items.push(lines[index].replace(/^[-*]\s+/, "")); index += 1; }
      output.push(<ul key={`${keyPrefix}-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = []; while (index < lines.length && /^\d+\.\s+/.test(lines[index])) { items.push(lines[index].replace(/^\d+\.\s+/, "")); index += 1; }
      output.push(<ol key={`${keyPrefix}-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ol>); continue;
    }
    if (line.startsWith("> ")) { output.push(<blockquote key={`${keyPrefix}-${index}`}>{renderInline(line.slice(2))}</blockquote>); index += 1; continue; }
    output.push(<p key={`${keyPrefix}-${index}`}>{renderInline(line)}</p>); index += 1;
  }
  return output;
};

export default function MarkdownMessage({ content }) {
  return <div className="coach-markdown">{content.split(/(```[\s\S]*?```)/g).filter(Boolean).map((block, index) => block.startsWith("```") ? <CodeBlock block={block} key={index} /> : renderTextBlocks(block, index))}</div>;
}
