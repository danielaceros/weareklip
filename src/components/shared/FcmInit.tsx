"use client";

import { useEffect } from "react";
import { ensureFcmToken } from "@/lib/messaging";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function FcmInit() {
  useEffect(() => {
    const auth = getAuth();
    let stopped = false;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || stopped) return;
      try {
        // Fuerza refresh del ID token (evita tokens caducados)
        const idToken = await user.getIdToken(true);

        // Asegura/obtiene token FCM
        const fcmToken = await ensureFcmToken();
        if (!fcmToken) {
          console.warn("[FCM] no hay token FCM");
          return;
        }

        // Registra en backend
        const res = await fetch("/api/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            token: fcmToken,
            platform: "web-android",
            userAgent: navigator.userAgent,
          }),
        });

        const json = await res.json().catch(() => ({}));
        console.log("[FCM] register token →", res.status, json);
      } catch (e) {
        console.error("[FCM] register failed", e);
      }
    });

    return () => {
      stopped = true;
      unsub();
    };
  }, []);

  return null;
}

