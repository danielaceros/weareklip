// lib/firebase-admin.ts
import admin from "firebase-admin";

export function initAdmin() {
  if (admin.apps.length) return;

  if (
    !process.env.FIREBASE_PROJECT_ID || 
    !process.env.FIREBASE_CLIENT_EMAIL || 
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error("Missing Firebase Admin environment variables");
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("Firebase Admin initialized successfully");
    }
  } catch (error) {
    console.error("Firebase admin initialization error", error);
  }
}

initAdmin();

// Exportaciones con alias para compatibilidad
export const db = admin.firestore();
export const adminDB = db; // alias para compatibilidad con el resto del código

export const auth = admin.auth();
export const adminAuth = auth; // alias para compatibilidad

export const storage = admin.storage().bucket();
export const adminStorage = admin.storage(); // si quieres el objeto storage entero

export { admin }; // por si necesitas el objeto completo
