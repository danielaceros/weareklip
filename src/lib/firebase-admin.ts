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

  // Normaliza bucket y fuerza .appspot.com
  let storageBucket =
    (process.env.FIREBASE_STORAGE_BUCKET || "").trim() ||
    `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
  storageBucket = storageBucket.replace(/\.firebasestorage\.app$/i, ".appspot.com");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePK(process.env.FIREBASE_PRIVATE_KEY),
    }),
    storageBucket,
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("Firebase Admin initialized successfully");
    console.log("Bucket:", storageBucket);
  }
}
initAdmin();

// Firestore
export const db = admin.firestore();
export const adminDB = db;

// Auth
export const auth = admin.auth();
export const adminAuth = auth;

// Storage (Bucket por defecto)
export const storage = admin.storage().bucket();
export const adminStorage = admin.storage();

// ✅ Re-exporta helpers que usa tu código
export const adminFieldValue = FieldValue;
export const adminTimestamp = Timestamp;

// Por si necesitas el objeto completo
export { admin };
