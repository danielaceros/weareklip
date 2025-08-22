// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC0s5D34lqrLYVDxC_5LrW3yifcP4sBbbI",
  authDomain: "klip-6e9a8.firebaseapp.com",
  projectId: "klip-6e9a8",
  storageBucket: "klip-6e9a8.firebasestorage.app",
  messagingSenderId: "32174180381",
  appId: "1:32174180381:web:d48749842fad36b4941ef4",
  measurementId: "G-8ELNB10WNP"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Configurar Auth
export const auth = getAuth(app);

export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;  // export the app instance for later use
