 import baileysPkg from "@whiskeysockets/baileys";
const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage } = baileysPkg;

import express from "express";
import bodyParser from "body-parser";

import { handleIncoming } from "./modules/messageHandler.js";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Health check route (VERY IMPORTANT for Railway)
app.get("/", (req, res) => {
  res.send("PolymathAI is running 🚀");
});

// 🔹 Start WhatsApp Bot
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
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
  });

  console.log("✅ WhatsApp bot started");
}

// Start server + bot
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await startBot();
});
