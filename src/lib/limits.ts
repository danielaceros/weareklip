// src/lib/limits.ts
export const MAX_AUDIO_SECONDS = 60;

// Palabras/segundo aproximadas por idioma (conservador)
export const WPS: Record<string, number> = {
  es: 2.8, // ~168 wpm
  en: 2.5, // ~150 wpm
  fr: 2.4, // ~144 wpm
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const wordCount = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

/** Estima segundos para TTS en función de idioma y velocidad */
export const estimateTtsSeconds = (text: string, lang = "es", speed = 1) => {
  const words = wordCount(text);
  const wps = WPS[lang] ?? 2.5;
  const s = clamp(speed || 1, 0.5, 2.0);
  return words / (wps * s);
};

/** Máximo de palabras que caben en MAX_AUDIO_SECONDS con idioma+velocidad */
export const maxWordsFor = (lang = "es", speed = 1) => {
  const wps = WPS[lang] ?? 2.5;
  const s = clamp(speed || 1, 0.5, 2.0);
  return Math.floor(wps * s * MAX_AUDIO_SECONDS);
};

