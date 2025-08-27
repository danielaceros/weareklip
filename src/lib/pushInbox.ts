// src/lib/pushInbox.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { onForegroundPush } from "@/lib/messaging";

/* =================== tipos =================== */
export type InboxItem = {
  id: string;
  title?: string;
  body?: string;
  read?: boolean;      // ya no lo usamos para mostrar, pero lo dejamos por si lo quieres
  ts?: number;
  data?: Record<string, string>;
};

/* =============== almacén global =============== */
type Listener = (items: InboxItem[]) => void;

let STORE: InboxItem[] = [];
const LISTENERS = new Set<Listener>();
let INITIALIZED = false;

// uid actual (para guardar por usuario)
let CURRENT_UID: string | null = null;

function emit() {
  const snapshot = STORE;
  for (const l of LISTENERS) l(snapshot);
}

function keyFor(uid: string | null) {
  return `klip:inbox:${uid ?? "anon"}`;
}

function persist() {
  try {
    if (typeof window === "undefined") return;
    const k = keyFor(CURRENT_UID);
    localStorage.setItem(k, JSON.stringify(STORE.slice(0, 100)));
  } catch {}
}

function loadFromStorage(uid: string | null) {
  try {
    if (typeof window === "undefined") return;
    const k = keyFor(uid);
    const raw = localStorage.getItem(k);
    const arr = raw ? (JSON.parse(raw) as InboxItem[]) : [];
    STORE = Array.isArray(arr) ? arr : [];
    emit();
  } catch {}
}

function upsertItem(n: InboxItem) {
  // evita duplicados por id
  const i = STORE.findIndex((x) => x.id === n.id);
  if (i >= 0) {
    STORE = [{ ...STORE[i], ...n }, ...STORE.slice(0, i), ...STORE.slice(i + 1)].slice(0, 50);
  } else {
    STORE = [n, ...STORE].slice(0, 50);
  }
  persist();
  emit();
}

// 👇 ahora “marcar una” = quitarla del inbox (como quieres)
function removeOneGlobal(id: string) {
  STORE = STORE.filter((n) => n.id !== id);
  persist();
  emit();
}

function removeAllGlobal() {
  STORE = [];
  persist();
  emit();
}

/* =========== init FCM + auth (una vez) =========== */
function payloadToItem(payload: any): InboxItem {
  const id =
    (payload?.messageId as string | undefined) ||
    (payload?.data?.id as string | undefined) ||
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2));

  return {
    id,
    title: payload?.notification?.title ?? payload?.data?.title ?? "Notificación",
    body: payload?.notification?.body ?? payload?.data?.body ?? "",
    data: (payload?.data as Record<string, string>) ?? {},
    ts: Date.now(),
    read: false,
  };
}

function ensureInitialized() {
  if (INITIALIZED || typeof window === "undefined") return;
  INITIALIZED = true;

  // Auth listener para cargar/limpiar por usuario
  import("firebase/auth")
    .then(({ getAuth, onAuthStateChanged }) => {
      const auth = getAuth();
      onAuthStateChanged(auth, (user) => {
        const nextUid = user?.uid ?? null;
        if (nextUid !== CURRENT_UID) {
          CURRENT_UID = nextUid;
          if (CURRENT_UID) {
            loadFromStorage(CURRENT_UID);
          } else {
            STORE = [];
            emit();
          }
        }
      });
    })
    .catch(() => {});

  // Foreground push
  try {
    const unsub = onForegroundPush((payload) => {
      const n = payloadToItem(payload);
      // console.log("[inbox] foreground push:", n);
      upsertItem(n);
    });
    if (typeof unsub !== "function") {
      // console.warn("[inbox] onForegroundPush no devolvió unsubscribe");
    }
  } catch {}

  // Background → BroadcastChannel
  try {
    const bc = new BroadcastChannel("klip-push");
    bc.onmessage = (e) => {
      const payload = e?.data?.payload;
      if (!payload) return;
      const n = payloadToItem(payload);
      // console.log("[inbox] background push:", n);
      upsertItem(n);
    };
  } catch {}
}

/* =================== hook público =================== */
export function usePushInbox() {
  ensureInitialized();

  const [items, setItems] = useState<InboxItem[]>(STORE);

  useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    LISTENERS.add(listener);
    // sincroniza por si ya hubo cambios
    setItems(STORE);
    return () => {
      LISTENERS.delete(listener);
    };
  }, []);

  const unread = useMemo(() => items.length, [items]); // ahora “unread” = total visible

  const markAllRead = () => removeAllGlobal();
  const markOne = (id: string) => removeOneGlobal(id);

  return { items, unread, markAllRead, markOne };
}
