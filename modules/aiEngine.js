export async function transcribeAudio() {
  // 🔴 Replace with Whisper API
  throw new Error("AI not connected");
}

export async function summarizeText(text) {
  // 🔴 Replace with GPT
  return text
    .split(".")
    .slice(0, 5)
    .map((t) => `• ${t.trim()}`)
    .join("\n");
}
