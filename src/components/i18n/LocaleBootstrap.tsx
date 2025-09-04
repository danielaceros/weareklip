// src/components/i18n/LocaleBootstrap.tsx
"use client";

import { useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { changeLocale, getStoredLocale, type Locale } from "@/lib/i18n";
import { doc, getDoc } from "firebase/firestore";

/**
 * - Si hay idioma en Firestore (users/{uid}.settings.lang), lo prioriza.
 * - Si no hay preferencia (cookie/LS) ni en Firestore: detecta con navigator.language.
 * - Persiste (cookie + localStorage) y recarga la página una sola vez.
 * - Cuando el usuario está autenticado, sincroniza lang en Firestore.
 */
export default function LocaleBootstrap() {
  useEffect(() => {
    // Evita bucles de recarga
    if (sessionStorage.getItem("__klip_locale_bootstrapped__") === "1") return;

    (async () => {
      const current = getStoredLocale(); // cookie/localStorage o 'es'

      // 1) Si hay usuario, intenta leer su lang en Firestore y priorizarlo
      const profileLang = await getUserLangFromFirestore().catch(() => null);
      if (profileLang && profileLang !== current) {
        sessionStorage.setItem("__klip_locale_bootstrapped__", "1");
        // Sincroniza y cambia (pone cookie/LS y recarga)
        await syncUserLang(profileLang);
        changeLocale(profileLang);
        return;
      }

      // 2) Si no había cookie/LS, usa navegador
      const hasCookieOrLS =
        typeof document !== "undefined" &&
        (document.cookie.includes("NEXT_LOCALE=") ||
          localStorage.getItem("locale"));

      if (!hasCookieOrLS) {
        const browser = guessFromNavigator();
        if (browser && browser !== current) {
          sessionStorage.setItem("__klip_locale_bootstrapped__", "1");
          await syncUserLang(browser);
          changeLocale(browser);
          return;
        }
      }

      // 3) Ya estaba configurado: sincroniza perfil (si hay user) y marca bootstrap hecho
      await syncUserLang(current);
      sessionStorage.setItem("__klip_locale_bootstrapped__", "1");
    })();
  }, []);

  return null;
}

function guessFromNavigator(): Locale | null {
  if (typeof navigator === "undefined") return null;
  const n = navigator.language.toLowerCase();
  if (n.startsWith("es")) return "es";
  if (n.startsWith("en")) return "en";
  if (n.startsWith("fr")) return "fr";
  return "es";
}

async function getUserLangFromFirestore(): Promise<Locale | null> {
  const u = auth.currentUser;
  if (!u) return null;

  const idToken = await u.getIdToken();
  const res = await fetch(`/api/firebase/users/${u.uid}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    console.error("❌ Error al obtener user settings:", await res.text());
    return null;
  }

  const data = await res.json();
  const lang: unknown = data?.settings?.lang;
  if (lang === "es" || lang === "en" || lang === "fr") return lang;

  return null;
}


async function syncUserLang(lang: Locale) {
  try {
    const u = auth.currentUser;
    if (!u) return;
    const token = await u.getIdToken();
    await fetch("/api/firebase/users/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lang }),
      keepalive: true,
    });
  } catch {
    // silencioso
  }
}

