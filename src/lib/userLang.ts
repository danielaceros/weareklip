import { auth } from "@/lib/firebase";
import type { Locale } from "@/lib/i18n";

/**
 * Lee el idioma preferido del usuario desde tu API CRUD.
 * Orden de prioridad manejado en backend.
 */
export async function getUserLang(uid?: string): Promise<Locale> {
  const userId = uid ?? auth.currentUser?.uid;
  if (!userId) return "es";

  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) return "es";

  try {
    const res = await fetch(`/api/firebase/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!res.ok) throw new Error(`Error ${res.status} al obtener usuario`);

    const user = await res.json();

    const lang: unknown =
      user?.settings?.lang ?? user?.lang; // fallback legacy
    if (lang === "es" || lang === "en" || lang === "fr") return lang;

    return "es";
  } catch (err) {
    console.error("❌ Error obteniendo idioma del usuario:", err);
    return "es";
  }
}

/**
 * Actualiza el idioma preferido del usuario vía API CRUD.
 */
export async function setUserLang(next: Locale, uid?: string) {
  const userId = uid ?? auth.currentUser?.uid;
  if (!userId) throw new Error("No hay usuario autenticado");

  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("No autenticado");

  const res = await fetch(`/api/firebase/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      settings: { lang: next },
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Error actualizando idioma: ${msg}`);
  }

  return true;
}
