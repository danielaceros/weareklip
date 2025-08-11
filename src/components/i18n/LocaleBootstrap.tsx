"use client";

import { useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { changeLocale, getStoredLocale, type Locale } from "@/lib/i18n";

/**
 * Decide el mejor locale:
 * 1) cookie/localStorage (si existe)
 * 2) Firestore: users/{uid}/settings.lang
 * 3) navigator.language
 */
function pickFromNavigator(): Locale {
  try {
    const lang = (navigator.language || "").toLowerCase();
    if (lang.startsWith("es")) return "es";
    if (lang.startsWith("fr")) return "fr";
    return "en";
  } catch {
    return "es";
  }
}

export default function LocaleBootstrap() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      // 1) Cookie/localStorage
      const stored = getStoredLocale(); // 'es' | 'en' | 'fr' (o default interno)
      if (stored) {
        // Si ya coincide con <html lang>, no hacemos nada
        if (typeof document !== "undefined" && document.documentElement.lang === stored) return;

        // Aplica inmediatamente (set cookie + reload)
        changeLocale(stored);
        return;
      }

      // 2) Si hay usuario, intenta leer Firestore
      const user = auth.currentUser;
      if (user) {
        try {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          const fsLocale = snap.exists() ? (snap.data()?.settings?.lang as Locale | undefined) : undefined;

          if (fsLocale) {
            changeLocale(fsLocale);
            return;
          }
        } catch {
          // silencioso
        }
      }

      // 3) Navigator fallback
      const nav = pickFromNavigator();
      // Guarda en Firestore si hay usuario y aún no estaba
      if (user) {
        try {
          await setDoc(
            doc(db, "users", user.uid),
            { settings: { lang: nav, updatedAt: Date.now() } },
            { merge: true }
          );
        } catch {
          // silencioso
        }
      }
      changeLocale(nav);
    })();
  }, []);

  return null;
}
