"use client";

import { getAuth } from "firebase/auth";
import type { EventKey } from "./notification-templates";

export async function sendEventPushClient(
  kind: EventKey,
  data?: Record<string, unknown>
) {
  try {
    const user = getAuth().currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();

    const res = await fetch("/api/notify/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      // 👇 evita que se aborte al cambiar de página
      keepalive: true,
      body: JSON.stringify({ kind, data: data ?? {} }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.warn("[push-client] fallo", res.status, j);
    } else {
      // opcional: comenta si no quieres ruido
      // console.log("[push-client] ok", kind);
    }
  } catch (e) {
    console.warn("[push-client] error:", e);
  }
}
