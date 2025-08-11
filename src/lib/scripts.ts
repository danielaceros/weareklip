// src/lib/scripts.ts
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import type { Locale } from "@/lib/i18n";

/** Estructura del guion en BBDD */
export type GuionDoc = {
  titulo?: string;
  contenido?: string;
  estado?: number;   // 0 nuevo, 1 cambios, 2 aprobado
  creadoEn?: string; // ISO string (ordenas por "creadoEn")
  lang?: Locale;     // 'es' | 'en' | 'fr'
  notas?: string;
};

/** Crea un guion forzando el campo lang y creadoEn */
export async function createGuion(
  userId: string,
  data: Omit<GuionDoc, "lang" | "creadoEn">,
  lang: Locale
) {
  const colRef = collection(db, "users", userId, "guiones");
  const payload: GuionDoc = {
    ...data,
    lang,
    creadoEn: new Date().toISOString(),
  };
  const ref = await addDoc(colRef, payload);
  return ref.id;
}

/** Actualiza un guion; si pasas lang, lo fija */
export async function updateGuion(
  userId: string,
  guionId: string,
  data: Partial<GuionDoc>,
  lang?: Locale
) {
  const ref = doc(db, "users", userId, "guiones", guionId);
  const payload: Partial<GuionDoc> = { ...data };
  if (lang !== undefined) payload.lang = lang;
  await updateDoc(ref, payload);
}

/** Crea/mergea un guion con ID concreto; añade creadoEn si no está */
export async function setGuion(
  userId: string,
  guionId: string,
  data: Partial<GuionDoc>,
  lang?: Locale
) {
  const ref = doc(db, "users", userId, "guiones", guionId);
  const payload: Partial<GuionDoc> = { ...data };
  if (lang !== undefined) payload.lang = lang;
  if (!payload.creadoEn) payload.creadoEn = new Date().toISOString();
  await setDoc(ref, payload, { merge: true });
}

/** Asegura que un doc existente tenga lang (útil para backfill) */
export async function ensureGuionLang(
  userId: string,
  guionId: string,
  fallback: Locale
) {
  const ref = doc(db, "users", userId, "guiones", guionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as GuionDoc;
  if (!data.lang) {
    await updateDoc(ref, { lang: fallback });
  }
}
