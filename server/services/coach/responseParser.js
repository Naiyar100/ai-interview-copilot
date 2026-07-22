export const extractCoachText = (payload) =>
  (payload?.candidates || []).flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => typeof part.text === "string" ? part.text : "").join("");

export const parseSseEvents = (buffer) => {
  const blocks = buffer.replaceAll("\r\n", "\n").split("\n\n");
  const remainder = blocks.pop() || "";
  const events = blocks.map((block) => block.split("\n").filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim()).join("\n"))
    .filter((data) => data && data !== "[DONE]").map((data) => JSON.parse(data));
  return { events, remainder };
};
