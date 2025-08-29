"use client";

import { useEffect, useState } from "react";
import { auth, storage } from "@/lib/firebase";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

// Definir un tipo para la suscripción sin usar any
interface Subscription {
  status: string;
  plan: string;
  [key: string]: unknown;
}

interface ClonacionVideo {
  id: string;
  url: string;
  thumbnail?: string;
  storagePath?: string;
}

export function useUserPanel() {
  const t = useT();
  const [user, setUser] = useState<User | null>(null);
  const [clonacionVideos, setClonacionVideos] = useState<ClonacionVideo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true); // ✅ spinner en primera carga

  // Props extra para evitar errores de TS en SubscriptionSection
  const loadingSub = false;
  const sub: Subscription | undefined = undefined;
  const getStatusChipStyle = () => "";
  const renderStatusLabel = (status: string) => status;

  // Cargar usuario
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (loggedUser) => {
      setUser(loggedUser);
      if (loggedUser) {
        await fetchClonacionVideos(loggedUser.uid);
      } else {
        setClonacionVideos([]);
      }
      setLoading(false); // ✅ termina el loading tras la primera respuesta
    });
    return () => unsub();
  }, []);

  // Cargar vídeos de clonación
  const fetchClonacionVideos = async (uid: string) => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No autenticado");

      const idToken = await currentUser.getIdToken();

      const res = await fetch(`/api/firebase/users/${uid}/clones`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        throw new Error("Error al cargar videos de clonación");
      }

      const vids: ClonacionVideo[] = await res.json();
      setClonacionVideos(vids);
    } catch (err) {
      console.error("fetchClonacionVideos error:", err);
      toast.error("Error cargando vídeos de clonación");
    }
  };

  // Subir vídeo
  const handleUpload = async (file: File) => {
    if (!user) {
      toast.error(t("clonacion.mustLogin"));
      return;
    }

    const id = crypto.randomUUID();
    const storagePath = `users/${user.uid}/clonacion/${id}`;

    try {
      setUploading(true);
      setProgress(0);

      // 1) Subir a Storage
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const prog = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            setProgress(prog);
          },
          reject,
          resolve
        );
      });

      // 2) Obtener URL
      const url = await getDownloadURL(storageRef);

      // 3) Persistir en tu API (CRUD)
      const token = await user.getIdToken();
      const res = await fetch(`/api/firebase/users/${user.uid}/clonacion`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          url,
          storagePath,
          createdAt: Date.now(),
        }),
      });

      if (!res.ok) {
        throw new Error(`Error guardando clonación (${res.status})`);
      }

      toast.success(t("clonacion.uploadSuccess"));
      setUploading(false);
      setProgress(0);
      await fetchClonacionVideos(user.uid);
    } catch (err) {
      console.error("❌ Upload error:", err);
      toast.error(t("clonacion.uploadError"));
      setUploading(false);
    }
  };

  const handleDelete = async (videoId: string, storagePath: string) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();

      // 1) Eliminar doc via API
      const res = await fetch(
        `/api/firebase/users/${user.uid}/clonacion/${videoId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error(`Error borrando doc (${res.status})`);

      // 2) Eliminar archivo de Storage
      if (storagePath) {
        try {
          await deleteObject(ref(storage, storagePath));
        } catch (storageErr) {
          console.warn("⚠️ Error borrando en Storage:", storageErr);
        }
      }

      toast.success(t("clonacion.deleteSuccess"));
      await fetchClonacionVideos(user.uid);
    } catch (err) {
      console.error(err);
      toast.error(t("clonacion.deleteError"));
    }
  };

  return {
    t,
    user,
    clonacionVideos,
    handleUpload,
    handleDelete,
    uploading,
    progress,
    loading, // 👈 ahora lo exponemos

    // Props extra para SubscriptionSection
    loadingSub,
    sub,
    getStatusChipStyle,
    renderStatusLabel,
  };
}
