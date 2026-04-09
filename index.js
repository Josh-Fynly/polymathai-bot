import makeWASocket, {
  fetchLatestBaileysVersion,
  makeInMemoryStore
} from "@whispr/baileys";

import express from "express";
import fs from "fs";

console.log("🟡 FILE LOADED");

const app = express();
const PORT = process.env.PORT || 3000;

const AUTH_FILE = "./auth.json";

async function loadAuth() {
  if (fs.existsSync(AUTH_FILE)) {
    return JSON.parse(fs.readFileSync(AUTH_FILE));
  }
  return {};
}

async function saveAuth(state) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
}

async function startBot() {
  console.log("🟡 startBot() called");

  try {
    const { version } = await fetchLatestBaileysVersion();
    console.log("🟢 Baileys version fetched");

    const authState = await loadAuth();

    const sock = makeWASocket({
      version,
      auth: authState,
    });

    sock.ev.on("creds.update", saveAuth);

    sock.ev.on("connection.update", async (update) => {
      console.log("🔄 Connection update:", update);

      const { connection, qr } = update;

      if (qr) {
        console.log("📱 Scan this QR manually:");
        console.log(qr);
      }

      if (connection === "open") {
        console.log("✅ CONNECTED");
      }

      if (connection === "close") {
        console.log("❌ CONNECTION CLOSED");
      }
    });

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
  res.send("Running");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  startBot();
});
