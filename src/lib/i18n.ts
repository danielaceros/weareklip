// src/lib/i18n.ts
import { useTranslations } from 'next-intl';

/* -------------------------------------------------------------------------- */
/* 🌐 Config básico de idiomas                                                */
/* -------------------------------------------------------------------------- */

export const LOCALES = {
  es: 'Español',
  en: 'English'
} as const;

export type Locale = keyof typeof LOCALES;

const STORAGE_KEY = 'locale';

/* -------------------------------------------------------------------------- */
/* 🔄 Leer / cambiar idioma                                                   */
/* -------------------------------------------------------------------------- */

/** Devuelve el locale guardado o 'es' por defecto */
export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'es';
  const saved = localStorage.getItem(STORAGE_KEY);
  return (saved && saved in LOCALES ? saved : 'es') as Locale;
}

/**
 * Cambia el idioma, lo guarda en localStorage y refresca la ruta actual
 * para que next-intl cargue los nuevos mensajes.
 */
export function changeLocale(locale: Locale) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, locale);

  // Recarga suave: vuelve a la misma ruta para que next-intl rehidrate
  const { pathname, search } = window.location;
  window.location.assign(`${pathname}${search}`);
}

/* -------------------------------------------------------------------------- */
/* 🏷️  Hook de traducción con fallback seguro                                 */
/* -------------------------------------------------------------------------- */

/**
 * useT() envuelve useTranslations() e incluye fallback local
 * por si la clave no existe en el JSON.
 */
export function useT() {
  const t = useTranslations();

  return (key: string) => {
    try {
      return t(key);
    } catch {
      return key; // fallback: devuelve la clave tal cual
    }
  };
}
