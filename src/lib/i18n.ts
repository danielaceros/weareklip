// src/lib/i18n.ts
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

/* -------------------------------------------------------------------------- */
/* 🌐 Config básico de idiomas                                                */
/* -------------------------------------------------------------------------- */

export const LOCALES = {
  es: 'Español',
  en: 'English',
  fr: 'Français'
} as const;

export type Locale = keyof typeof LOCALES;

const STORAGE_KEY = 'locale';
const LOCALE_COOKIE = 'NEXT_LOCALE'; // 👈 cookie que usa next-intl en el servidor

/* -------------------------------------------------------------------------- */
/* 🔧 Helpers cookie                                                          */
/* -------------------------------------------------------------------------- */

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

/* -------------------------------------------------------------------------- */
/* 🔄 Leer / cambiar idioma                                                   */
/* -------------------------------------------------------------------------- */

/** Devuelve el locale guardado (cookie > localStorage) o 'es' por defecto */
export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'es';

  // 1) Prioriza cookie que el servidor usa para next-intl
  const cookieVal = getCookie(LOCALE_COOKIE);
  if (cookieVal && cookieVal in LOCALES) {
    return cookieVal as Locale;
  }

  // 2) Fallback a localStorage (compatibilidad)
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && saved in LOCALES) {
    return saved as Locale;
  }

  return 'es';
}

/**
 * Cambia el idioma, lo guarda en cookie (SSR) y localStorage (compat),
 * y recarga la ruta actual para que next-intl cargue los nuevos mensajes.
 */
export function changeLocale(locale: Locale) {
  if (typeof window === 'undefined') return;

  // Persistencia SSR: cookie que next-intl leerá en el servidor
  setCookie(LOCALE_COOKIE, locale);

  // Persistencia cliente (compat con código existente)
  localStorage.setItem(STORAGE_KEY, locale);

  // Recarga suave: misma ruta + query
  const { pathname, search } = window.location;
  window.location.assign(`${pathname}${search}`);
}

/* -------------------------------------------------------------------------- */
/* 🏷️  Hook de traducción con fallback seguro + variables                     */
/* -------------------------------------------------------------------------- */

/**
 * useT() envuelve useTranslations() e incluye fallback local
 * por si la clave no existe en el JSON, y soporta variables.
 * 🔒 Memoizado para que NO cambie en cada render.
 */
export function useT() {
  const t = useTranslations();

  return useMemo(
    () =>
      (key: string, values?: Record<string, string | number>) => {
        try {
          return t(key, values); // pasa las variables al traductor
        } catch {
          return key; // fallback: devuelve la clave tal cual si no existe
        }
      },
    [t]
  );
}

