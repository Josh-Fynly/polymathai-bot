import pkg from "baileys";
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = pkg;

import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
    });

    // Save session
    sock.ev.on("creds.update", saveCreds);

    // 🔍 Connection monitoring
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        console.log("❌ Connection closed:");
        console.log(lastDisconnect?.error);
      }

      if (connection === "open") {
        console.log("✅ WhatsApp connected successfully");
      }
    });

    // 🔑 Pairing (only once)
    if (!state.creds.registered) {
      const phoneNumber = "2348126480871"; // your number

      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log("🔑 PAIRING CODE:", code);
      } catch (err) {
        console.error("❌ Pairing error:", err);
      }
    }

    // 📩 SIMPLE MESSAGE TEST (no modules yet)
    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages[0];
        if (!msg.message) return;

        const sender = msg.key.remoteJid;

        await sock.sendMessage(sender, {
          text: "🤖 PolymathAI is live (test mode)"
        });

      } catch (err) {
        console.error("❌ Message handling error:", err);
      }
    });

    console.log("🚀 Bot initialized");

  } catch (err) {
    console.error("🔥 FATAL START ERROR:");
    console.error(err);
  }
}

// 🌐 Health check (Railway requirement)
app.get("/", (req, res) => {
  res.send("PolymathAI running");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  startBot();
});
