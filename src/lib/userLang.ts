import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { Locale } from "@/lib/i18n";

/**
 * Lee el idioma preferido del usuario desde Firestore.
 * Orden de prioridad:
 * 1) users/{uid}/settings/profile.lang               (subcolección + doc)
 * 2) users/{uid}.settings.lang                       (campo anidado en el doc raíz)  ✅ lo que guarda tu API
 * 3) users/{uid}.lang                                (legacy)
 * Si no encuentra nada, devuelve 'es'.
 */
export async function getUserLang(uid?: string): Promise<Locale> {
  const userId = uid ?? auth.currentUser?.uid;
  if (!userId) return "es";

  // 1) users/{uid}/settings/profile.lang
  try {
    const ref1 = doc(db, "users", userId, "settings", "profile");
    const snap1 = await getDoc(ref1);
    const lang1 = (snap1.exists() ? snap1.data()?.lang : null) as Locale | null;
    if (lang1 === "es" || lang1 === "en" || lang1 === "fr") return lang1;
  } catch {}

  // 2) users/{uid}.settings.lang  (campo anidado en el doc raíz)
  try {
    const ref2 = doc(db, "users", userId);
    const snap2 = await getDoc(ref2);
    const lang2 = (snap2.exists() ? (snap2.get("settings.lang") as Locale | null) : null);
    if (lang2 === "es" || lang2 === "en" || lang2 === "fr") return lang2;
  } catch {}

  // 3) users/{uid}.lang (legacy)
  try {
    const ref3 = doc(db, "users", userId);
    const snap3 = await getDoc(ref3);
    const lang3 = (snap3.exists() ? (snap3.data()?.lang as Locale | null) : null);
    if (lang3 === "es" || lang3 === "en" || lang3 === "fr") return lang3;
  } catch {}

  return "es";
}
