// src/lib/messaging.ts
"use client";

import app from "@/lib/firebase";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
} from "firebase/messaging";

let messaging: Messaging | null = null;

async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // Registra (o reutiliza) el SW en /firebase-messaging-sw.js
  // En dev recarga si lo editas
  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  return reg;
}

export async function ensureFcmToken(): Promise<string | null> {
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  if (Notification.permission !== "granted") {
    const res = await Notification.requestPermission();
    if (res !== "granted") return null;
  }

  if (!messaging) messaging = getMessaging(app);
  const reg = await registerSW();
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: reg ?? undefined,
  }).catch(() => null);

  return token;
}

export async function onForegroundPush(cb: (payload: any) => void) {
  const supported = await isSupported().catch(() => false);
  if (!supported) return;
  if (!messaging) messaging = getMessaging(app);
  onMessage(messaging, (payload) => cb(payload));
}

