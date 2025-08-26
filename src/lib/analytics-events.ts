// src/lib/analytics-events.ts
"use client";

import { analytics } from "@/lib/firebase";
import type { Analytics } from "firebase/analytics";
import { logEvent, setUserId, setUserProperties } from "firebase/analytics";

type Params = Record<string, unknown>;

function safeLog(ana: Analytics | null | undefined, name: string, params?: Params) {
  if (!ana) return;
  try { logEvent(ana, name, params as any); } catch {}
}

/** Dispara un evento GA4 */
export function track(name: string, params: Params = {}) {
  if (typeof window === "undefined") return;
  safeLog(analytics, name, params);
}

/** Pageview manual (Next App Router no lo hace solo) */
export function trackPageView(path: string, title?: string) {
  track("page_view", {
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
    page_path: path,
    page_title: title || document?.title,
  });
}

/** Identidad de usuario (NUNCA mandes PII como email plano) */
export function setUserIdentity(uid: string, props?: Params) {
  if (typeof window === "undefined") return;
  try {
    if (analytics) setUserId(analytics, uid);
    if (analytics && props) setUserProperties(analytics, props as any);
  } catch {}
}

/** Medir duración de acciones asíncronas */
export async function withTiming<T>(name: string, fn: () => Promise<T>, extra?: Params) {
  const t0 = performance.now();
  try {
    const result = await fn();
    const t1 = performance.now();
    track(`${name}_success`, { ...extra, duration_ms: Math.round(t1 - t0) });
    return result;
  } catch (err) {
    const t1 = performance.now();
    track(`${name}_error`, { ...extra, duration_ms: Math.round(t1 - t0), error: String(err) });
    throw err;
  }
}
