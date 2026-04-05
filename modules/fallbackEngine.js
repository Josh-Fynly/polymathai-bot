export async function basicTranscribe() {
  return "Audio received. Key ideas detected.";
}

export function heuristicSummary(text) {
  const sentences = text.split(".");
  return sentences
    .slice(0, 5)
    .map((s) => `• ${s.trim()}`)
    .join("\n");
}
