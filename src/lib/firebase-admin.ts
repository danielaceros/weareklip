// src/lib/firebase-admin.ts
import admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// Normaliza la private key (maneja comillas y \n)
function normalizePrivateKey(key?: string) {
  if (!key) return undefined;
  let unwrapped = key;
  if (unwrapped.startsWith('"') && unwrapped.endsWith('"')) {
    unwrapped = unwrapped.slice(1, -1);
  }
  return unwrapped.replace(/\\n/g, "\n");
}

export function initAdmin(): void {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    (projectId ? `https://${projectId}.firebaseio.com` : undefined);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "[firebase-admin] Faltan FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY"
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    ...(storageBucket ? { storageBucket } : {}),
    ...(databaseURL ? { databaseURL } : {}),
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[firebase-admin] initialized");
  }
}
initAdmin();

// App
const app = admin.app();

// Auth
export const adminAuth = admin.auth(app);
export const auth = adminAuth; // alias

// Firestore
export const adminDB = admin.firestore(app);
export const db = adminDB; // alias

// Storage (objeto Storage y Bucket por defecto)
export const adminStorage = admin.storage(app); // objeto Storage
export const storageObj = adminStorage;         // alias explícito del objeto Storage
export const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
  ? adminStorage.bucket(process.env.FIREBASE_STORAGE_BUCKET)
  : adminStorage.bucket();                      // Bucket por defecto
export const bucket = storageBucket;            // alias del Bucket

// Para compatibilidad: muchos proyectos esperan "storage" como Bucket
export const storage = storageBucket;

// Helpers Firestore
export const adminFieldValue = FieldValue;
export const adminTimestamp = Timestamp;

// Por si necesitas el namespace completo o la app
export { admin };
export { app };
