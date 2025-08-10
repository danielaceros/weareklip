// lib/firebase-admin.ts
import admin from "firebase-admin";

function initAdmin() {
  if (admin.apps.length) return;

  if (!process.env.FIREBASE_PROJECT_ID || 
      !process.env.FIREBASE_CLIENT_EMAIL || 
      !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error("Missing Firebase Admin environment variables");
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("Firebase Admin initialized successfully");
    }
  } catch (error) {
    console.error("Firebase admin initialization error", error);
  }
}

// Inicializar al cargar este módulo
initAdmin();

export const adminDB = admin.firestore();
export const adminAuth = admin.auth();
