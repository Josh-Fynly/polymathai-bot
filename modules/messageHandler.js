import { checkCache, saveCache } from "./cacheManager.js";
import { getUser, updateUsage } from "./userManager.js";
import { transcribeAudio, summarizeText } from "./aiEngine.js";
import { basicTranscribe, heuristicSummary } from "./fallbackEngine.js";
import { hashBuffer } from "../utils/helpers.js";

// ================= CONFIG =================
const FREE_LIMIT = 1;
const MAX_FREE_SECONDS = 90;

// ================= HUMANIZATION =================

// Tone detection (simple but effective)
function detectTone(text = "") {
  text = text.toLowerCase();

  if (text.includes("explain") || text.includes("teach")) return "teacher";
  if (text.includes("simple")) return "simple";
  if (text.includes("brief") || text.includes("short")) return "concise";

  return "friendly";
}

// Human response builder
function humanize(content, tone = "friendly") {
  const intros = {
    friendly: [
      "Alright, here’s what I got from it:",
      "Okay, let me break it down for you:",
      "Here’s a quick summary for you:",
    ],
    teacher: [
      "Let’s go through this step by step:",
      "Here’s a clear explanation:",
      "Pay attention to these key points:",
    ],
    simple: [
      "In simple terms:",
      "Here’s the easy version:",
    ],
    concise: [
      "Quick breakdown:",
      "Short summary:",
    ],
  };

  const intro =
    intros[tone][Math.floor(Math.random() * intros[tone].length)];

  return `${intro}\n\n${content}`;
}

// Branding footer
function footer(text) {
  return `${text}

⚡ Powered by PolymathAI
Invite friends: wa.me/yourlink`;
}

// Limit message
function limitMsg() {
  return footer(`You've used your free daily limit.

Upgrade here 👇
[Paystack link]`);
}

// ================= MAIN HANDLER =================
export async function handleIncoming({ message, audioBuffer, sock, sender }) {
  try {
    let user = await getUser(sender) || { isPaid: false, dailyUsage: 0 };

    // ================= TEXT =================
    if (message?.conversation) {
      const tone = detectTone(message.conversation);

      const reply = humanize(
        "Send a voice note and I’ll turn it into clean text plus a smart summary.",
        tone
      );

      await sock.sendMessage(sender, { text: footer(reply) });
      return;
    }

    // ================= AUDIO =================
    if (audioBuffer) {
      const audioHash = hashBuffer(audioBuffer);

      // 🔁 CACHE FIRST
      const cached = await checkCache(audioHash);
      if (cached) {
        await sock.sendMessage(sender, { text: footer(cached) });
        return;
      }

      // 🔒 LIMIT CHECK
      if (!user.isPaid && user.dailyUsage >= FREE_LIMIT) {
        await sock.sendMessage(sender, { text: limitMsg() });
        return;
      }

      // ⏱️ LENGTH CHECK (placeholder)
      const duration = 60;
      if (!user.isPaid && duration > MAX_FREE_SECONDS) {
        await sock.sendMessage(
          sender,
          {
            text: footer(
              "For best results, keep voice notes under 90 seconds on free plan."
            ),
          }
        );
        return;
      }

      let output = "";
      let tone = "friendly";

      try {
        // ================= AI PATH =================
        const text = await transcribeAudio(audioBuffer);
        tone = detectTone(text);

        const summary = await summarizeText(text, {
          mode: user.isPaid ? "full" : "cheap",
        });

        output = humanize(summary, tone);

      } catch (err) {
        console.log("AI failed → fallback engaged");

        // ================= FALLBACK PATH =================
        const roughText = await basicTranscribe(audioBuffer);
        tone = detectTone(roughText);

        const summary = heuristicSummary(roughText);

        output = humanize(summary, tone);
      }

      // 💾 CACHE
      await saveCache(audioHash, output);

      // 📊 USAGE UPDATE
      await updateUsage(sender);

      // 📤 SEND
      await sock.sendMessage(sender, {
        text: footer(output),
      });
    }

  } catch (err) {
    console.error("Fatal error:", err);

    await sock.sendMessage(sender, {
      text: footer(
        "Something went off on my end. Try again in a bit."
      ),
    });
  }
    }
