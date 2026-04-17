import express from "express";
import fetch from "node-fetch";
import { handleIncoming } from "./modules/messageHandler.js";
import { getUser, updateUsage } from "./modules/userManager.js";
import { checkCache, saveCache } from "./modules/cacheManager.js";
import { hashBuffer } from "./utils/helpers.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

if (!VERIFY_TOKEN || !WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

console.log("✅ Environment variables loaded");

// ============================================
// 🔹 WEBHOOK VERIFICATION
// ============================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    return res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verification failed");
    return res.sendStatus(403);
  }
});

// ============================================
// 🔹 MESSAGE HANDLER
// ============================================
app.post("/webhook", async (req, res) => {
  try {
    // Extract message from Meta webhook payload
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    const sender = changes?.value?.contacts?.[0]?.wa_id;

    if (!message || !sender) {
      console.log("⚠️ No message or sender found");
      return res.sendStatus(200);
    }

    console.log("📩 Message received from:", sender);

    // ============================================
    // TEXT MESSAGE HANDLING
    // ============================================
    if (message.type === "text" && message.text?.body) {
      const text = message.text.body;
      console.log("📝 Text message:", text);

      // Get user for tone detection
      let user = await getUser(sender) || { isPaid: false, dailyUsage: 0 };

      // Import tone detection from messageHandler
      const tone = detectTone(text);

      // Build response (for now, echo with humanization)
      const reply = `Hi! Thanks for your message:\n\n"${text}"\n\nI'm still learning, but soon I'll be able to:\n• Transcribe voice notes\n• Summarize texts\n• Help with coding\n• And much more!\n\n⚡ Powered by PolymathAI`;

      await sendMessage(sender, reply);
      return res.sendStatus(200);
    }

    // ============================================
    // AUDIO MESSAGE HANDLING (Future)
    // ============================================
    if (message.type === "audio" && message.audio?.id) {
      console.log("🎤 Audio message received");
      const audioId = message.audio.id;

      // TODO: Download audio from Meta
      // TODO: Process through audioProcessor
      // TODO: Send to messageHandler for AI/fallback

      // For now, send placeholder response
      const reply = "🎤 Voice notes coming soon! Stay tuned.";
      await sendMessage(sender, reply);
      return res.sendStatus(200);
    }

    // ============================================
    // OTHER MESSAGE TYPES (image, document, etc.)
    // ============================================
    if (message.type === "image" || message.type === "document") {
      const reply = "📦 Media support is coming soon!";
      await sendMessage(sender, reply);
      return res.sendStatus(200);
    }

    console.log("⚠️ Unknown message type:", message.type);
    res.sendStatus(200);

  } catch (err) {
    console.error("🔥 ERROR in webhook:", err);
    res.sendStatus(500);
  }
});

// ============================================
// 🔹 HELPER: SEND MESSAGE VIA META API
// ============================================
async function sendMessage(to, text) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: { body: text },
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error("❌ Meta API error:", data.error);
    } else {
      console.log("✅ Message sent. ID:", data.messages?.[0]?.id);
    }

    return data;

  } catch (err) {
    console.error("🔥 Error sending message:", err);
  }
}

// ============================================
// 🔹 HELPER: TONE DETECTION
// ============================================
function detectTone(text = "") {
  text = text.toLowerCase();

  if (text.includes("explain") || text.includes("teach")) return "teacher";
  if (text.includes("simple")) return "simple";
  if (text.includes("brief") || text.includes("short")) return "concise";

  return "friendly";
}

// ============================================
// 🔹 HEALTH CHECK ENDPOINT
// ============================================
app.get("/", (req, res) => {
  res.json({
    status: "✅ PolymathAI running",
    version: "1.0.0-beta",
    webhook: "https://polymathai-bot-production.up.railway.app/webhook",
  });
});

// ============================================
// 🔹 START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 PolymathAI server running on port ${PORT}`);
  console.log(`📍 Webhook URL: https://polymathai-bot-production.up.railway.app/webhook`);
  console.log(`🔑 Environment: ${process.env.NODE_ENV || "development"}`);
});
        
