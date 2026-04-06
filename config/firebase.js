import admin from "firebase-admin";

// 🔐 Decode Base64 safely
const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (!base64) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env variable");
}

const serviceAccount = JSON.parse(
  Buffer.from(base64, "base64").toString("utf-8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const db = admin.firestore();