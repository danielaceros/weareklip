// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC0s5D34lqrLYVDxC_5LrW3yifcP4sBbbI",
  authDomain: "klip-6e9a8.firebaseapp.com",
  projectId: "klip-6e9a8",
  storageBucket: "klip-6e9a8.firebasestorage.app",
  messagingSenderId: "32174180381",
  appId: "1:32174180381:web:d48749842fad36b4941ef4",
  measurementId: "G-8ELNB10WNP", // 👈 necesario para Analytics
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Configurar Auth
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Configurar Analytics (solo si está soportado y en navegador)
let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  isSupported().then((yes) => {
    if (yes) {
      analytics = getAnalytics(app);
    }
  });
}

export { analytics };
export default app; // export the app instance for later use
