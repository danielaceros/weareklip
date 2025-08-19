// src/lib/firebase-admin.ts
import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  getFirestore,
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let app: App;

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawKey = process.env.FIREBASE_PRIVATE_KEY;

// Convierte los \n del .env a saltos de línea reales
const privateKey = (rawKey || "").replace(/\\n/g, "\n");

if (!getApps().length) {
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "[firebase-admin] Faltan FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY"
    );
  }

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    ...(process.env.FIREBASE_STORAGE_BUCKET
      ? { storageBucket: process.env.FIREBASE_STORAGE_BUCKET }
      : {}),
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[firebase-admin] initialized (modular)");
  }
} else {
  app = getApps()[0]!;
}

export const adminAuth = getAuth(app);
export const adminDB = getFirestore(app);
export const adminStorage = getStorage(app);
export const adminTimestamp = Timestamp;
export const adminFieldValue = FieldValue;
