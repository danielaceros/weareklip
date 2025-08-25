/* -------------------------------------------------------------------------- */
/* 🌗 Helpers de tema (light/dark)                                           */
/* -------------------------------------------------------------------------- */

const THEME_STORAGE_KEY = "theme";

/**
 * Aplica el tema (light o dark):
 *  - Cambia la clase en <html>
 *  - Guarda preferencia en localStorage
 */
export function setTheme(theme: "light" | "dark") {
  if (typeof window === "undefined") return;

  const html = document.documentElement;
  html.classList.remove("light", "dark");
  html.classList.add(theme);

  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

/**
 * Devuelve el tema guardado o "light" por defecto
 * y lo aplica al cargar la página.
 */
export function initTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";

  const saved = localStorage.getItem(THEME_STORAGE_KEY) as "light" | "dark" | null;
  const theme = saved === "dark" ? "dark" : "light";

  setTheme(theme);
  return theme;
}
