// src/lib/theme.ts
/* -------------------------------------------------------------------------- */
/* 🎨 Helpers de color de acento                                              */
/* -------------------------------------------------------------------------- */

export type AccentId = 'blue' | 'green' | 'orange' | 'rose';

type Palette = Record<50 | 200 | 500 | 700 | 900, string>;

export const ACCENTS: { id: AccentId; label: string; palette: Palette }[] = [
  {
    id: 'blue',
    label: 'Azul',
    palette: {
      50:  '#eff6ff',
      200: '#bfdbfe',
      500: '#3b82f6',
      700: '#1d4ed8',
      900: '#1e3a8a'
    }
  },
  {
    id: 'green',
    label: 'Verde',
    palette: {
      50:  '#ecfdf5',
      200: '#bbf7d0',
      500: '#10b981',
      700: '#047857',
      900: '#064e3b'
    }
  },
  {
    id: 'orange',
    label: 'Naranja',
    palette: {
      50:  '#fff7ed',
      200: '#fed7aa',
      500: '#f97316',
      700: '#c2410c',
      900: '#7c2d12'
    }
  },
  {
    id: 'rose',
    label: 'Rosa',
    palette: {
      50:  '#fff1f2',
      200: '#fecdd3',
      500: '#f43f5e',
      700: '#be123c',
      900: '#881337'
    }
  }
];

/* Nombre de la clase que se aplica al <html> */
const CLASS_PREFIX = 'accent-';
const STORAGE_KEY  = 'accent';

/**
 * Aplica el color de acento:
 *  - Cambia la clase en <html>
 *  - Guarda preferencia en localStorage
 */
export function setAccent(id: AccentId) {
  if (typeof window === 'undefined') return;
  const html = document.documentElement;

  /* Quita cualquier clase accent-* */
  ACCENTS.forEach(a => html.classList.remove(CLASS_PREFIX + a.id));

  /* Añade la nueva */
  html.classList.add(CLASS_PREFIX + id);

  /* Persiste */
  localStorage.setItem(STORAGE_KEY, id);
}

/**
 * Devuelve el color de acento guardado o 'blue' por defecto
 * y lo aplica al cargar la página.
 */
export function initAccent(): AccentId {
  if (typeof window === 'undefined') return 'blue';

  const saved = localStorage.getItem(STORAGE_KEY) as AccentId | null;
  const id: AccentId = saved && ACCENTS.some(a => a.id === saved) ? saved : 'blue';
  setAccent(id);
  return id;
}
