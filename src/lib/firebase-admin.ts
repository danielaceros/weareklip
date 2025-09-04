// src/lib/firebase-admin.ts
import admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

function normalizePK(pk?: string) {
  if (!pk) return undefined;
  let v = pk.trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  return v.replace(/\\n/g, "\n");
}

export function initAdmin() {
  if (admin.apps.length) return;

  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error("Missing Firebase Admin environment variables");
  }

  // 👇 Usa directamente el bucket configurado (firebasestorage.app)
  const storageBucket =
    (process.env.FIREBASE_STORAGE_BUCKET || "").trim() ||
    `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePK(process.env.FIREBASE_PRIVATE_KEY),
    }),
    storageBucket,
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
  });
  admin.firestore().settings({ ignoreUndefinedProperties: true });

  if (process.env.NODE_ENV !== "production") {
    console.log("🔥 Firebase Admin initialized");
    console.log("🎯 Bucket configurado:", storageBucket);
  }
}
initAdmin();

// Firestore
export const adminDB = admin.firestore();
// Auth
export const adminAuth = admin.auth();

// ✅ Bucket ya configurado
export const adminBucket = admin.storage().bucket();

// Helpers
export const adminFieldValue = FieldValue;
export const adminTimestamp = Timestamp;

// Export admin completo
export { admin };

