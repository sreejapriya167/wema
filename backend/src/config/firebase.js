import admin from "firebase-admin";
import { env } from "./env.js";

let firebaseApp;

export function getFirebaseAdmin() {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (!env.firebaseProjectId || !env.firebaseClientEmail || !env.firebasePrivateKey) {
    return null;
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey
    })
  });

  return firebaseApp;
}

