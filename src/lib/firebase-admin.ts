// lib/firebase-admin.ts
import admin from "firebase-admin";

// Verificar que las variables de entorno están disponibles
if (!process.env.FIREBASE_PROJECT_ID || 
    !process.env.FIREBASE_CLIENT_EMAIL || 
    !process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error("Missing Firebase Admin environment variables");
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Manejar correctamente los saltos de línea
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase admin initialization error", error);
  }
}

export const adminDB = admin.firestore();
export const adminAuth = admin.auth();