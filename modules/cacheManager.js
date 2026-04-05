import { db } from "../config/firebase.js";

const CACHE = "audioCache";

export async function checkCache(hash) {
  const doc = await db.collection(CACHE).doc(hash).get();
  return doc.exists ? doc.data().result : null;
}

export async function saveCache(hash, result) {
  await db.collection(CACHE).doc(hash).set({
    result,
    timestamp: Date.now(),
  });
}
