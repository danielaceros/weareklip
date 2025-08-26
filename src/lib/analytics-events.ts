"use client";

import { analytics } from "./firebase";
import { logEvent, setUserId } from "firebase/analytics";

/** Llama a GA4 sin romper SSR ni pruebas */
export function track(name: string, params: Record<string, any> = {}) {
  try {
    if (!analytics) return;
    logEvent(analytics, name as any, params);
  } catch {}
}

/** Vincula el usuario autenticado a GA4 */
export function identify(uid?: string | null) {
  try {
    if (analytics && uid) setUserId(analytics, uid);
  } catch {}
}
