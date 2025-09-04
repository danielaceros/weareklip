// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  type Analytics,
} from "firebase/analytics";

// ⚙️ Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC0s5D34lqrLYVDxC_5LrW3yifcP4sBbbI",
  authDomain: "klip-6e9a8.firebaseapp.com",
  projectId: "klip-6e9a8",
  storageBucket: "klip-6e9a8.firebasestorage.app",
  messagingSenderId: "32174180381",
  appId: "1:32174180381:web:d48749842fad36b4941ef4",
  measurementId: "G-8ELNB10WNP",
};

// 🧩 Inicialización única
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Servicios básicos
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 📈 Analytics (solo navegador si está soportado)
let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  isAnalyticsSupported()
    .then((yes) => {
      if (yes) analytics = getAnalytics(app);
    })
    .catch(() => {});
}

// 🚀 Performance (sin instrumentación automática para evitar el error)
// Nota: el error venía porque Perf intentaba registrar atributos con cadenas larguísimas de clases Tailwind.
let perf: any = null;
if (typeof window !== "undefined") {
  (async () => {
    try {
      const { initializePerformance } = await import("firebase/performance");
      const isDev = process.env.NODE_ENV !== "production";
      perf = initializePerformance(app, {
        dataCollectionEnabled: !isDev, // recoge datos solo en producción
        instrumentationEnabled: false, // 🔧 desactiva web-vitals auto → evita "performance/invalid attribute value"
      });
    } catch (e) {
      console.warn("[perf] desactivado:", e);
    }
  })();
}

export { analytics, perf };
export default app;

