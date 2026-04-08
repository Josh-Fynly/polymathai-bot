import pkg from "baileys";
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} = pkg;

import express from "express";
import bodyParser from "body-parser";

import { handleIncoming } from "./modules/messageHandler.js";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
    });

    sock.ev.on("creds.update", saveCreds);

    // 🔍 Connection logs
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        console.log("❌ Connection closed:", lastDisconnect?.error);
      }

      if (connection === "open") {
        console.log("✅ WhatsApp connected");
      }
    });

    // 🔥 Pairing (SAFE)
    if (!state.creds.registered) {
      const phoneNumber = "2348126480871"; // FIX THIS

      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log("🔑 PAIRING CODE:", code);
      } catch (err) {
        console.error("❌ Pairing error:", err);
      }
    }

    // 📩 Message handling
    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages[0];
        if (!msg.message) return;

        const sender = msg.key.remoteJid;

        let audioBuffer = null;

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
        console.error("❌ Message error:", err);
      }
    });

    console.log("🚀 Bot initialized");

  } catch (err) {
    console.error("🔥 FATAL START ERROR:", err);
  }
}

// 🌐 Server (Railway requirement)
app.get("/", (req, res) => {
  res.send("PolymathAI running");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  startBot();
});
