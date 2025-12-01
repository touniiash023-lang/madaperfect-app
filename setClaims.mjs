import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Usage : node setClaims.mjs email role
const email = process.argv[2];
const role = process.argv[3];

if (!email || !role) {
  console.error("Usage: node setClaims.mjs email role");
  process.exit(1);
}

async function setRole() {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role });
    console.log(`Rôle '${role}' appliqué à : ${email}`);
  } catch (e) {
    console.error("Erreur:", e.message);
  }
}

setRole();
