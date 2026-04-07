import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} from "baileys";

import express from "express";
import bodyParser from "body-parser";

import { handleIncoming } from "./modules/messageHandler.js";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// 🔹 Start WhatsApp Bot
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
  });

  // Save session
  sock.ev.on("creds.update", saveCreds);

  // 🔥 PAIRING CODE LOGIN (Railway compatible)
  if (!sock.authState.creds.registered) {
    const phoneNumber = "2348126480871"; // ⚠️ REPLACE WITH YOUR NUMBER

    const code = await sock.requestPairingCode(phoneNumber);
    console.log("🔑 PAIRING CODE:", code);
  }

  // 🔹 Listen for messages
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg.message) return;

      const sender = msg.key.remoteJid;

      let audioBuffer = null;

      // 🎤 Handle voice notes
      if (msg.message.audioMessage) {
        audioBuffer = await downloadMediaMessage(msg, "buffer");
      }

      await handleIncoming({
        message: msg.message,
        audioBuffer,
        sock,
        sender,
      });

    } catch (err) {
      console.error("Message handling error:", err);
    }
  });

  console.log("🚀 PolymathAI bot started...");
}

// 🔹 Start Express server
app.get("/", (req, res) => {
  res.send("PolymathAI is running");
});

app.listen(PORT, async () => {
  console.log(`🌐 Server running on port ${PORT}`);
  await startBot();
});
