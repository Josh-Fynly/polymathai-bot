import makeWASocket, {
  useMultiFileAuthState,
  downloadMediaMessage
} from "baileys";

import express from "express";
import bodyParser from "body-parser";

import { handleIncoming } from "./modules/messageHandler.js";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// 🔥 Start WhatsApp Bot
async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        console.log(" Connection closed. Reconnecting...");
        startBot();
      } else if (connection === "open") {
        console.log(" WhatsApp connected");
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages[0];
        if (!msg.message) return;

        const sender = msg.key.remoteJid;

        let audioBuffer = null;

        if (msg.message.audioMessage) {
          audioBuffer = await downloadMediaMessage(
            msg,
            "buffer",
            {},
            { logger: console }
          );
        }

        await handleIncoming({
          message: msg.message,
          audioBuffer,
          sock,
          sender,
        });

      } catch (err) {
        console.error(" Message handling error:", err);
      }
    });

  } catch (err) {
    console.error(" Bot startup error:", err);
  }
}

// 🌐 Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await startBot();
});
