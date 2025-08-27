// lib/firebase.ts
// Importar SDKs necesarios
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  type Analytics,
} from "firebase/analytics";
import { getPerformance } from "firebase/performance";

// Configuración de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC0s5D34lqrLYVDxC_5LrW3yifcP4sBbbI",
  authDomain: "klip-6e9a8.firebaseapp.com",
  projectId: "klip-6e9a8",
  storageBucket: "klip-6e9a8.firebasestorage.app",
  messagingSenderId: "32174180381",
  appId: "1:32174180381:web:d48749842fad36b4941ef4",
  measurementId: "G-8ELNB10WNP", // 👈 Necesario para Analytics
};

// Inicializar Firebase (evitamos inicializar dos veces)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Servicios básicos
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics (solo navegador y si está soportado)
let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  isAnalyticsSupported().then((yes) => {
    if (yes) {
      analytics = getAnalytics(app);
    }
  });
}

// Performance Monitoring (solo navegador)
let perf: ReturnType<typeof getPerformance> | null = null;
if (typeof window !== "undefined") {
  try {
    perf = getPerformance(app);
  } catch (err) {
    console.warn("Performance Monitoring no disponible:", err);
  }
}

export { analytics, perf };
export default app;
