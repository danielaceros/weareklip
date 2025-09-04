// src/lib/scripts.ts
import type { Locale } from "@/lib/i18n";
import type { User } from "firebase/auth";

export type ScriptDoc = {
  titulo?: string;
  contenido?: string;
  estado?: number;   // 0 nuevo, 1 cambios, 2 aprobado
  creadoEn?: string; // ISO string
  lang?: Locale;     // 'es' | 'en' | 'fr'
  notas?: string;
};

/** Crea un guion en backend */
export async function createScript(
  user: User,
  data: Omit<ScriptDoc, "lang" | "creadoEn">,
  lang: Locale
) {
  const idToken = await user.getIdToken();
  const res = await fetch(`/api/firebase/users/${user.uid}/scripts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      ...data,
      lang,
      creadoEn: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error("Error creando guion");
  const json = await res.json();
  return json.id as string;
}

/** Actualiza un guion existente */
export async function updateScript(
  user: User,
  scriptId: string,
  data: Partial<ScriptDoc>,
  lang?: Locale
) {
  const idToken = await user.getIdToken();
  const payload: Partial<ScriptDoc> = { ...data };
  if (lang !== undefined) payload.lang = lang;

  const res = await fetch(`/api/firebase/users/${user.uid}/scripts/${scriptId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Error actualizando guion");
}

/** Crea/mergea un guion con ID concreto */
export async function setScript(
  user: User,
  scriptId: string,
  data: Partial<ScriptDoc>,
  lang?: Locale
) {
  const idToken = await user.getIdToken();
  const payload: Partial<ScriptDoc> = { ...data };
  if (lang !== undefined) payload.lang = lang;
  if (!payload.creadoEn) payload.creadoEn = new Date().toISOString();

  const res = await fetch(`/api/firebase/users/${user.uid}/scripts/${scriptId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Error guardando guion");
}

/** Asegura que un doc existente tenga lang */
export async function ensureScriptLang(user: User, scriptId: string, fallback: Locale) {
  const idToken = await user.getIdToken();
  const res = await fetch(`/api/firebase/users/${user.uid}/scripts/${scriptId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return;

  const doc = await res.json();
  if (!doc.lang) {
    await updateScript(user, scriptId, { lang: fallback });
  }
}

