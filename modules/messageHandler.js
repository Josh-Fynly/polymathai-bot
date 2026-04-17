import { checkCache, saveCache } from "./cacheManager.js";
import { getUser, updateUsage } from "./userManager.js";
import { transcribeAudio, summarizeText } from "./aiEngine.js";
import { basicTranscribe, heuristicSummary } from "./fallbackEngine.js";
import { hashBuffer } from "../utils/helpers.js";

// ================= CONFIG =================
const FREE_LIMIT = 1; // 1 request per day
const MAX_FREE_SECONDS = 90; // max audio length

// ================= HUMANIZATION =================

// Tone detection (simple but effective)
export function detectTone(text = "") {
  text = text.toLowerCase();

  if (text.includes("explain") || text.includes("teach")) return "teacher";
  if (text.includes("simple")) return "simple";
  if (text.includes("brief") || text.includes("short")) return "concise";

  return "friendly";
}

// Human response builder
export function humanize(content, tone = "friendly") {
  const intros = {
    friendly: [
      "Alright, here's what I got from it:",
      "Okay, let me break it down for you:",
      "Here's a quick summary for you:",
    ],
    teacher: [
      "Let's go through this step by step:",
      "Here's a clear explanation:",
      "Pay attention to these key points:",
    ],
    simple: [
      "In simple terms:",
      "Here's the easy version:",
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
export function footer(text) {
  return `${text}

⚡ Powered by PolymathAI
Join our community: wa.me/yourlink`;
}

// Limit message
export function limitMsg() {
  return footer(`You've used your free daily limit.

Upgrade here 👇
[Link coming soon]`);
}

// ================= MAIN HANDLER =================
/**
 * Handle incoming messages from Meta Cloud API
 * 
 * @param {Object} params - Handler parameters
 * @param {string} params.sender - Phone number (wa_id from Meta)
 * @param {string} params.text - Text message body (optional)
 * @param {Buffer} params.audioBuffer - Audio buffer from downloaded file (optional)
 * @param {Function} params.sendMessage - Function to send reply via Meta API
 */
export async function handleIncoming({ sender, text, audioBuffer, sendMessage }) {
  try {
    let user = await getUser(sender) || { isPaid: false, dailyUsage: 0 };

    // ================= TEXT MESSAGE =================
    if (text && !audioBuffer) {
      console.log(`📝 Processing text from ${sender}`);
      
      const tone = detectTone(text);

      const reply = humanize(
        "Send a voice note and I'll turn it into clean text plus a smart summary.\n\nOr ask me anything!",
        tone
      );

      await sendMessage(sender, footer(reply));
      return;
    }

    // ================= AUDIO MESSAGE =================
    if (audioBuffer) {
      console.log(`🎤 Processing audio from ${sender}`);
      
      const audioHash = hashBuffer(audioBuffer);

      // 🔁 CACHE FIRST
      const cached = await checkCache(audioHash);
      if (cached) {
        console.log("💾 Sending cached response");
        await sendMessage(sender, footer(cached));
        return;
      }

      // 🔒 LIMIT CHECK
      if (!user.isPaid && user.dailyUsage >= FREE_LIMIT) {
        console.log("⚠️ Free limit exceeded");
        await sendMessage(sender, limitMsg());
        return;
      }

      // ⏱️ LENGTH CHECK (get duration from audio)
      const duration = getAudioDuration(audioBuffer); // in seconds
      if (!user.isPaid && duration > MAX_FREE_SECONDS) {
        console.log(`⚠️ Audio too long: ${duration}s > ${MAX_FREE_SECONDS}s`);
        await sendMessage(
          sender,
          footer(
            `For best results, keep voice notes under 90 seconds on the free plan.\n\nYours: ${duration}s`
          )
        );
        return;
      }

      let output = "";
      let tone = "friendly";

      try {
        // ================= AI PATH =================
        console.log("🤖 Attempting AI transcription...");
        
        const text = await transcribeAudio(audioBuffer);
        tone = detectTone(text);

        const summary = await summarizeText(text, {
          mode: user.isPaid ? "full" : "cheap",
        });

        output = humanize(summary, tone);
        console.log("✅ AI path successful");

      } catch (err) {
        console.log("⚠️ AI failed → fallback engaged");

        // ================= FALLBACK PATH =================
        try {
          const roughText = await basicTranscribe(audioBuffer);
          tone = detectTone(roughText);

          const summary = heuristicSummary(roughText);
          output = humanize(summary, tone);

          console.log("✅ Fallback path successful");
        } catch (fallbackErr) {
          console.error("🔥 Both AI and fallback failed:", fallbackErr);
          
          await sendMessage(
            sender,
            footer("Something went wrong processing your audio. Please try again.")
          );
          return;
        }
      }

      // 💾 CACHE
      await saveCache(audioHash, output);

      // 📊 USAGE UPDATE
      await updateUsage(sender);

      // 📤 SEND
      await sendMessage(sender, footer(output));
    }

  } catch (err) {
    console.error("🔥 Fatal error in messageHandler:", err);

    // Send error message to user
    try {
      await sendMessage(
        sender,
        footer("Something went off on my end. Try again in a bit.")
      );
    } catch (sendErr) {
      console.error("Could not send error message:", sendErr);
    }
  }
}

// ================= UTILITY HELPERS =================

/**
 * Get audio duration in seconds (approximate)
 * For accurate duration, you'd need to parse the audio file
 * This is a placeholder that estimates from buffer size
 */
function getAudioDuration(buffer) {
  // Rough estimate: 16kHz 16-bit mono ≈ 32KB per second
  // This is very approximate and should be replaced with proper duration detection
  const estimatedSeconds = Math.round(buffer.length / 32000);
  return estimatedSeconds || 5; // default to 5s if estimation fails
}

/**
 * Prepare audio for processing
 * - Check bitrate
 * - Validate format
 * - Return metadata
 */
export function validateAudio(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty audio buffer");
  }

  if (buffer.length > 25 * 1024 * 1024) {
    // 25MB limit
    throw new Error("Audio file too large (max 25MB)");
  }

  return {
    size: buffer.length,
    duration: getAudioDuration(buffer),
    hash: hashBuffer(buffer),
  };
            }
