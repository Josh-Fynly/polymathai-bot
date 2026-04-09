import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from "@whispr/baileys";

import express from "express";

console.log("🟡 FILE LOADED");

const app = express();
const PORT = process.env.PORT || 3000;

async function startBot() {
  console.log("🟡 startBot() called");

  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    console.log("🟢 Auth state loaded");

    const { version } = await fetchLatestBaileysVersion();
    console.log("🟢 Baileys version fetched");

    const sock = makeWASocket({
      version,
      auth: state,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      console.log("🔄 Connection update:", update);

      const { connection } = update;

      if (connection === "open") {
        console.log("✅ CONNECTED");
      }

      if (connection === "close") {
        console.log("❌ CONNECTION CLOSED");
      }
    });

    if (!state.creds.registered) {
      console.log("🟡 Requesting pairing code...");

      const code = await sock.requestPairingCode("2348126480871");
      console.log("🔑 PAIRING CODE:", code);
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
      console.log("📩 MESSAGE EVENT TRIGGERED");

      const msg = messages[0];
      if (!msg.message) return;

      const sender = msg.key.remoteJid;

      await sock.sendMessage(sender, {
        text: "Bot is alive ✅"
      });
    });

  } catch (err) {
    console.error("🔥 FATAL ERROR:");
    console.error(err);
  }
}

app.get("/", (req, res) => {
  console.log("🌐 Health route hit");
  res.send("Running");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  startBot();
});
