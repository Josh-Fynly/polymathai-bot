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

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
  });

  // 🔐 Save session
  sock.ev.on("creds.update", saveCreds);

  // 🔍 Connection monitoring (VERY IMPORTANT)
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      console.log("❌ Connection closed:", lastDisconnect?.error);
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected successfully");
    }
  });

  // 🔥 PAIRING (ONLY WHEN NOT REGISTERED)
  if (!state.creds.registered) {
    const phoneNumber = "2348126480871"; // 🔴 PUT YOUR NUMBER HERE

    const code = await sock.requestPairingCode(phoneNumber);
    console.log("🔑 PAIRING CODE:", code);
  }

  // 📩 Message listener
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg.message) return;

      const sender = msg.key.remoteJid;

      let audioBuffer = null;

      // 🎤 Voice note handling
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
      console.error("❌ Message handling error:", err);
    }
  });

  console.log("🚀 PolymathAI bot started...");
}

// 🌐 Health route (important for Railway)
app.get("/", (req, res) => {
  res.send("PolymathAI is running");
});

app.listen(PORT, async () => {
  console.log(`🌐 Server running on port ${PORT}`);
  await startBot();
});
