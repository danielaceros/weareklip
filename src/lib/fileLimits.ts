// src/lib/fileLimits.ts
export const MB = 1024 * 1024;

export const LIMITS = {
  video: 100 * MB, // 100 MB
  audio: 10 * MB,  // 10 MB
  other: 100 * MB,
} as const;

export type MediaKind = "video" | "audio" | "other";

export function kindForFile(file: File): MediaKind {
  if (file?.type?.startsWith("audio/")) return "audio";
  if (file?.type?.startsWith("video/")) return "video";
  return "other";
}

/** Valida según su mimetype (comportamiento por defecto) */
export function validateFileSize(
  file: File
): { ok: true } | { ok: false; message: string } {
  return validateFileSizeAs(file, kindForFile(file));
}

/** Valida forzando el tipo (útil por contexto: p.ej. muestras de voz = audio) */
export function validateFileSizeAs(
  file: File,
  as: MediaKind
): { ok: true } | { ok: false; message: string } {
  const max = LIMITS[as];
  if (file.size > max) {
    const mb = Math.round(max / MB);
    const label =
      as === "audio" ? "audio" : as === "video" ? "vídeo" : "archivo";
    return {
      ok: false,
      message: `El ${label} supera el tamaño máximo permitido (${mb} MB).`,
    };
  }
  return { ok: true };
}
