// src/lib/uploadVideo.ts
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

/** Lee metadatos del vídeo (ancho/alto) desde un File usando un <video> virtual */
async function readVideoMetadata(
  file: File
): Promise<{ width: number; height: number }> {
  // Seguridad básica por tipo MIME
  if (!file.type?.startsWith("video/")) {
    throw new Error("upload.errors.invalidType"); // i18n (opcional)
  }

  const url = URL.createObjectURL(file);
  try {
    const dims = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = url;
        v.onloadedmetadata = () => {
          const width = v.videoWidth;
          const height = v.videoHeight;
          if (width && height) resolve({ width, height });
          else reject(new Error("upload.errors.cantRead"));
        };
        v.onerror = () => reject(new Error("upload.errors.cantRead"));
      }
    );
    return dims;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Valida vertical 9:16 y resolución máxima 1080×1920 */
async function validateVideoConstraints(file: File): Promise<void> {
  const { width, height } = await readVideoMetadata(file);

  // Debe ser vertical
  if (height <= width) {
    throw new Error("upload.errors.notVertical"); // "Formato no permitido: debe ser vertical."
  }

  // Relación 9:16 con pequeña tolerancia (±1%)
  const ASPECT = 9 / 16;
  const TOL = 0.01;
  const ratio = width / height;
  if (Math.abs(ratio - ASPECT) > TOL) {
    throw new Error("upload.errors.notAspect916"); // "El vídeo debe tener relación 9:16."
  }

  // Resolución máxima
  if (width > 1080 || height > 1920) {
    // "Resolución máxima 1080×1920. Actual: {w}×{h}."
    const err = new Error("upload.errors.tooBigResolution");
    // @ts-expect-error añadimos datos para quien los quiera usar
    err.meta = { w: width, h: height };
    throw err;
  }
}

/**
 * Sube un vídeo a Firebase Storage y devuelve la URL pública.
 * Valida previamente: vertical 9:16 y resolución ≤ 1080×1920.
 *
 * @param file Archivo de vídeo
 * @param uid  UID del usuario en Firebase
 * @param onProgress Callback opcional para actualizar el progreso (0-100)
 */
export async function uploadVideo(
  file: File,
  uid: string,
  onProgress?: (progress: number) => void
): Promise<{ downloadURL: string }> {
  // ✅ Validación previa (bloquea horizontales y >1080×1920)
  await validateVideoConstraints(file);

  return new Promise((resolve, reject) => {
    const safeName = file.name?.replace(/[^\w.\- ]+/g, "_") || "video.mp4";
    const fileRef = ref(storage, `users/${uid}/videos/${Date.now()}_${safeName}`);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(Math.round(progress));
      },
      (error) => reject(error),
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ downloadURL });
      }
    );
  });
}
