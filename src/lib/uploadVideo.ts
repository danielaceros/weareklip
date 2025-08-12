import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

/**
 * Sube un vídeo a Firebase Storage y devuelve la URL pública
 * @param file Archivo de vídeo
 * @param uid UID del usuario en Firebase
 * @param onProgress Callback opcional para actualizar el progreso (0-100)
 */
export async function uploadVideo(
  file: File,
  uid: string,
  onProgress?: (progress: number) => void
): Promise<{ downloadURL: string }> {
  return new Promise((resolve, reject) => {
    const fileRef = ref(storage, `users/${uid}/videos/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(Math.round(progress));
      },
      (error) => reject(error),
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ downloadURL });
      }
    );
  });
}
