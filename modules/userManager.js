import { db } from "../config/firebase.js";

const USERS = "users";

export async function getUser(phone) {
  const doc = await db.collection(USERS).doc(phone).get();
  return doc.exists ? doc.data() : null;
}

export async function updateUsage(phone) {
  const ref = db.collection(USERS).doc(phone);

  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);

    if (!doc.exists) {
      t.set(ref, { dailyUsage: 1, isPaid: false });
    } else {
      t.update(ref, {
        dailyUsage: (doc.data().dailyUsage || 0) + 1,
      });
    }
  });
}
